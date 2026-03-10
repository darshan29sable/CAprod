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

// Block access to sensitive files
app.use((req, res, next) => {
    const forbidden = ['server.js', 'package.json', 'package-lock.json', 'render.yaml', 'Procfile', '.gitignore', 'vercel.json', 'vecel.json', 'server.py'];
    if (forbidden.some(f => req.url.includes(f))) {
        return res.status(403).send('Access Denied');
    }
    next();
});

// ---------------- CONFIG HELPERS ----------------

// Helper to safely extract a JS variable from a file
function getJsVar(filePath, varName) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const regex = new RegExp(`const\\s+${varName}\\s*=\\s*([\\s\\S]*?);(\\r?\\n|$)`);
        const match = content.match(regex);
        if (!match) return null;
        
        // Use a Function constructor to safely evaluate the JS object/array
        return new Function(`return ${match[1]}`)();
    } catch (err) {
        console.error(`Error parsing ${varName} from ${filePath}:`, err.message);
        return null;
    }
}

function getFullConfig() {
    return getJsVar(CONFIG_PATH, 'CONFIG');
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

app.post('/api/admin/save-config', adminCheck, (req, res) => {
    try {
        const newConfig = req.body;
        const configStr = `const CONFIG = ${JSON.stringify(newConfig, null, 4)};`;
        fs.writeFileSync(CONFIG_PATH, configStr, 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------------- CONTENT MANAGEMENT ----------------

function getFullContent(){
    const FREE_RESOURCES = getJsVar(CONTENT_PATH, 'FREE_RESOURCES');
    const EXCLUSIVE_RESOURCES = getJsVar(CONTENT_PATH, 'EXCLUSIVE_RESOURCES');
    const youtubeVideos = getJsVar(CONTENT_PATH, 'youtubeVideos');

    if (FREE_RESOURCES && EXCLUSIVE_RESOURCES && youtubeVideos) {
        return { FREE_RESOURCES, EXCLUSIVE_RESOURCES, youtubeVideos };
    }
    return null;
}

app.get('/api/admin/content',adminCheck,(req,res)=>{

    const data = getFullContent();

    if(data){
        res.json(data);
    } else {
        res.status(500).json({success:false});
    }

});

app.post('/api/admin/save-content', adminCheck, (req, res) => {
    try {
        const { FREE_RESOURCES, EXCLUSIVE_RESOURCES, youtubeVideos } = req.body;
        
        let contentStr = `
// Free Learning Resources
const FREE_RESOURCES = ${JSON.stringify(FREE_RESOURCES, null, 4)};

// Exclusive Community Resources
const EXCLUSIVE_RESOURCES = ${JSON.stringify(EXCLUSIVE_RESOURCES, null, 4)};

// Combined for easy lookup
const ALL_RESOURCES = [...FREE_RESOURCES, ...EXCLUSIVE_RESOURCES.map(r => ({ ...r, exclusive: true }))];

const youtubeVideos = ${JSON.stringify(youtubeVideos, null, 4)};
`;
        fs.writeFileSync(CONTENT_PATH, contentStr, 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------------- STATIC FILES ----------------

app.use(express.static(__dirname));

app.get('*',(req,res,next)=>{
    const url = req.url.split('?')[0];
    const base = path.basename(url);
    
    // If it looks like an API call or a specific file, skip the index.html fallback
    if(url.startsWith('/api/') || url === '/config.js' || url === '/content.js' || base.includes('.')){
        return next();
    }
    
    // Otherwise serve index.html for SPA-style routing
    res.sendFile(path.join(__dirname,'index.html'));
});

// ---------------- START SERVER ----------------

app.listen(PORT,'0.0.0.0',()=>{

    console.log("\n====================================");
    console.log(" Node.js Server Running on Render");
    console.log(" Port:",PORT);
    console.log("====================================\n");

});