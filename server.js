const express = require("express");
const fs = require("fs");
const unlinkSync = require("node:fs");
const app = express();
const port = 3000;
const index = fs.readFileSync("./index.html", "utf8");
var html = "<!DOCTYPE html><html><head></head><body></body></html>";

function makeFolder(path) {
    try {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
    } catch (err) {
        console.error(err);
    }
}

function writeFile(path, content) {
    try {
        fs.writeFileSync(path, content);
    } catch (err) {
        console.error(err);
    }
}

function readFile(path) {
    try {
        const data = fs.readFileSync(path, "utf8");
        return data;
    } catch (err) {
        console.error(err);
    }
}
makeFolder("./chats");

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

app.use("/", express.static("./"));
app.use(express.json());

app.get("/", (req, res) => {
    res.send(index);
});

app.post("/api/savechats", (req, res) => {
    var ids = Object.keys(req.body);
    for (let i = 0; i < ids.length; i++) {
        writeFile(`./chats/${ids[i]}.json`, JSON.stringify(req.body[ids[i]]));
        console.log(`Saving ./chats/${ids[i]}.json`);
    }
});

app.post("/api/deletechats", (req, res) => {
    var ids = req.body;
    for (let i = 0; i < ids.length; i++) {
        if (fs.existsSync(`./chats/${ids[i]}.json`)) {
            fs.unlinkSync(`./chats/${ids[i]}.json`);
            console.log(`Deleting ./chats/${ids[i]}.json`);
        }
    }
});

app.post("/api/getchats", (req, res) => {
    var chats = {};
    const files = fs.readdirSync("./chats/");
    for (let i = 0; i < files.length; i++) {
        var id = parseInt(files[i].slice(0, -5));
        chats[id] = JSON.parse(readFile("./chats/" + files[i]));
    }
    res.send(JSON.stringify(chats));
});

app.get("/api/htmlviewer", (req, res) => {
    res.send(html);
});

app.put("/api/htmlviewer", (req, res) => {
    if (req.body.html) {
        html = req.body.html;
        res.send(true);
    } else {
        res.send(false);
    }
});

app.listen(port, () => {
    console.log(`ollamafied running on http://127.0.0.1:${port}`);
});
