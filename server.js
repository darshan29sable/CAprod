const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// Render dynamic port
const PORT = process.env.PORT || 3030;

const CONFIG_PATH = path.join(__dirname, 'config.js');
const CONTENT_PATH = path.join(__dirname, 'content.js');

app.use(cors());
app.use(express.json());

// ---------------- CONFIG HELPERS ----------------

function getFullConfig() {
    try {
        const content = fs.readFileSync(CONFIG_PATH, 'utf8');
        const match = content.match(/const\s+CONFIG\s*=\s*(\{[\s\S]*\});?/);
        if (!match) return null;

        const rawObj = match[1];

        let jsonStr = rawObj
            .replace(/(\w+):/g, '"$1":')
            .replace(/,\s*}/g, '}')
            .replace(/,\s*\]/g, ']')
            .replace(/\/\/.*$/gm, '');

        try {
            return JSON.parse(jsonStr);
        } catch {
            let configData;
            eval('configData = ' + rawObj);
            return configData;
        }

    } catch {
        return null;
    }
}

function updateConfig(updater) {

    try {

        let content = fs.readFileSync(CONFIG_PATH,'utf8');

        const match = content.match(/const\s+CONFIG\s*=\s*(\{[\s\S]*\});?/);

        if(!match){
            return {success:false,message:"CONFIG not found"};
        }

        const rawObj = match[1];

        const configData = getFullConfig();

        if(!configData){
            return {success:false,message:"Config parse error"};
        }

        updater(configData);

        const newObjStr = JSON.stringify(configData,null,4);

        const newContent = content.replace(rawObj,newObjStr);

        fs.writeFileSync(CONFIG_PATH,newContent,'utf8');

        return {success:true};

    } catch(err){

        return {success:false,message:err.message};

    }

}

// ---------------- SECURITY CONFIG REDACTION ----------------

app.get('/config.js',(req,res)=>{

    try{

        const content = fs.readFileSync(CONFIG_PATH,'utf8');

        let redacted = content
            .replace(/"?password"?\s*:\s*".*?"\s*,?\s*/g,'')
            .replace(/"?recoveryCode"?\s*:\s*".*?"\s*,?\s*/g,'');

        res.setHeader('Content-Type','application/javascript');
        res.setHeader('Cache-Control','no-cache');

        res.send(redacted);

    } catch{

        res.status(500).send("Error reading config");

    }

});

// ---------------- LOGIN API ----------------

app.post('/api/login',(req,res)=>{

    const {username,password} = req.body;

    const config = getFullConfig();

    if(!config){
        return res.status(500).json({success:false});
    }

    const user = (config.users || []).find(
        u => String(u.username).toLowerCase() === String(username).toLowerCase()
    );

    if(!user){
        return res.json({success:false});
    }

    const decoded = Buffer.from(user.password,'base64').toString('utf8');

    if(decoded === password){

        return res.json({
            success:true,
            role:user.role || 'user',
            username:user.username
        });

    }

    res.json({success:false});

});

// ---------------- UPDATE SCORE ----------------

app.post('/api/update-score',(req,res)=>{

    const {username,testId,score} = req.body;

    const result = updateConfig(config=>{

        const user = (config.users || []).find(
            u => String(u.username).toLowerCase() === String(username).toLowerCase()
        );

        if(user){

            if(!user.scores){
                user.scores = {};
            }

            user.scores[testId] = score;

        }

    });

    res.status(result.success ? 200 : 500).json(result);

});

// ---------------- PASSWORD UPDATE ----------------

app.post('/api/update-password',(req,res)=>{

    const {username,newPasswordBase64} = req.body;

    const result = updateConfig(config=>{

        const user = (config.users || []).find(
            u => String(u.username).toLowerCase() === String(username).toLowerCase()
        );

        if(user){
            user.password = newPasswordBase64;
        }

    });

    res.status(result.success ? 200 : 500).json(result);

});

// ---------------- PASSWORD RESET ----------------

app.post('/api/reset-password',(req,res)=>{

    const {username,recoveryCode,newPasswordBase64} = req.body;

    const result = updateConfig(config=>{

        const user = (config.users || []).find(
            u => String(u.username).toLowerCase() === String(username).toLowerCase()
        );

        if(!user){
            throw new Error("NOT_A_MEMBER");
        }

        if(user.recoveryCode === String(recoveryCode)){

            user.password = newPasswordBase64;

        } else {

            throw new Error("Invalid Recovery Code");

        }

    });

    res.status(result.success ? 200 : 401).json(result);

});

// ---------------- ADMIN AUTH ----------------

function adminCheck(req,res,next){

    const adminUser = req.headers['x-admin-user'];
    const adminPass = req.headers['x-admin-pass'];

    const config = getFullConfig();

    const user = (config.users || []).find(
        u => u.username === adminUser && u.role === 'admin'
    );

    if(user){

        const decoded = Buffer.from(user.password,'base64').toString('utf8');

        if(decoded === adminPass){
            return next();
        }

    }

    res.status(403).json({success:false,message:"Unauthorized"});

}

// ---------------- ADMIN CONFIG ----------------

app.get('/api/admin/config',adminCheck,(req,res)=>{

    const config = getFullConfig();

    res.json(config);

});

// ---------------- CONTENT MANAGEMENT ----------------

function getFullContent(){

    try{

        const content = fs.readFileSync(CONTENT_PATH,'utf8');

        const freeRes = content.match(/const\s+FREE_RESOURCES\s*=\s*([\s\S]*?);/);
        const exclRes = content.match(/const\s+EXCLUSIVE_RESOURCES\s*=\s*([\s\S]*?);/);
        const videos = content.match(/const\s+youtubeVideos\s*=\s*([\s\S]*?);/);

        if(!freeRes || !exclRes || !videos){
            return null;
        }

        const clean = str => str
            .replace(/\/\*[\s\S]*?\*\//g,'')
            .replace(/\/\/.*$/gm,'')
            .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g,'$1"$2":')
            .replace(/:\s*'/g,': "')
            .replace(/'\s*,/g,'",')
            .replace(/'\s*\]/g,'"]')
            .replace(/,\s*}/g,'}')
            .replace(/,\s*\]/g,']');

        return {

            FREE_RESOURCES: JSON.parse(clean(freeRes[1])),
            EXCLUSIVE_RESOURCES: JSON.parse(clean(exclRes[1])),
            youtubeVideos: JSON.parse(clean(videos[1]))

        };

    } catch(e){

        console.log("Content parse error",e.message);

        return null;

    }

}

app.get('/api/admin/content',adminCheck,(req,res)=>{

    const data = getFullContent();

    if(data){
        res.json(data);
    } else {
        res.status(500).json({success:false});
    }

});

// ---------------- STATIC FILES ----------------

app.use(express.static(__dirname));

app.get('*',(req,res,next)=>{

    if(!req.url.startsWith('/api/') && req.url !== '/config.js'){

        res.sendFile(path.join(__dirname,'index.html'));

    } else {

        next();

    }

});

// ---------------- START SERVER ----------------

app.listen(PORT,'0.0.0.0',()=>{

    console.log("\n====================================");
    console.log(" Node.js Server Running on Render");
    console.log(" Port:",PORT);
    console.log("====================================\n");

});