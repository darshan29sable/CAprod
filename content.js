
// Free Learning Resources
const FREE_RESOURCES = [
    {
        "id": 1,
        "title": "Module 1: Ultimate RPA Basics",
        "desc": "Master the fundamentals of UiPath, Variables, selectors and control flow.",
        "link": "module.html?id=1"
    },
    {
        "id": 2,
        "title": "Module 2: Advanced UI Automation",
        "desc": "Deep dive into Excel, PDF, and dynamic UI interactions.",
        "link": "module.html?id=2"
    }
];

// Exclusive Community Resources
const EXCLUSIVE_RESOURCES = [
    {
        "id": 3,
        "title": "Module 3: REFramework Mastery",
        "desc": "Build enterprise-grade, scalable, and robust automation projects.",
        "link": "module.html?id=3"
    },
    {
        "id": 4,
        "title": "Module 4: AI & Document Understanding",
        "desc": "Integrate AI Agents, ML models, and intelligent document processing.",
        "link": "module.html?id=4"
    }
];

// Combined for easy lookup
const ALL_RESOURCES = [...FREE_RESOURCES, ...EXCLUSIVE_RESOURCES.map(r => ({ ...r, exclusive: true }))];

const youtubeVideos = [
    {
        "title": "UiPath End to End Project 2026",
        "id": "dQw4w9WgXcQ",
        "views": "25K",
        "duration": "45:20",
        "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    },
    {
        "title": "Mastering AI Agents in UiPath",
        "id": "abc123xyz",
        "views": "12K",
        "duration": "22:15",
        "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    }
];

const testimonials = [
    {
        "type": "image",
        "content": "chat_1.png",
        "author": "Verified Learner"
    },
    {
        "type": "text",
        "content": "Darshan, I just got hired as a Senior RPA Dev thanks to your Studio module! You are a legend.",
        "author": "Senior RPA Dev"
    }
];
