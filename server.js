const { createProxyServer } = require("http-proxy");
const express = require("express");
const https = require("https");
const fs = require("fs");
const app = express();
const index = fs.readFileSync("./index.html", "utf8");
var settings;
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

async function sha(buffer) {
    return crypto.subtle.digest("SHA-1", buffer).then((hashBuffer) => {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
            .map((bytes) => bytes.toString(16).padStart(2, "0"))
            .join("");
        return hashHex;
    });
}

async function checkFile(path, gitHash) {
    if (fs.existsSync(path)) {
        const file = fs.readFileSync(path);
        const fileHeader = new TextEncoder().encode(`blob ${file.length}\0`);
        const fileBuffer = new Uint8Array(fileHeader.length + file.length);
        fileBuffer.set(fileHeader);
        fileBuffer.set(file, fileHeader.length);
        const fileHash = await sha(fileBuffer);
        return fileHash == gitHash;
    } else {
        return false;
    }
}

async function updateFile(path, url) {
    if (!fs.existsSync(path) && path.split("/").length > 2) {
        var dir = "./";
        for (let i = 1; i < path.split("/").length - 1; i++) {
            dir += path.split("/")[i] + "/";
            makeFolder(dir);
        }
    }
    const response = await fetch(url);
    const blob = await response.blob();
    const buffer = await Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(path, buffer);
}

async function checkUpdates(path, download) {
    if (!path) {
        path = "";
    }
    try {
        const response = await fetch(
            "https://api.github.com/repos/Awesomefied/AwesomeChat/contents/" +
                path,
        );
        const json = await response.json();
        for (let i = 0; i < json.length; i++) {
            if (json[i].type == "file") {
                const isUpdated = await checkFile(
                    "./" + json[i].path,
                    json[i].sha,
                );
                if (!isUpdated && download) {
                    await updateFile("./" + json[i].path, json[i].download_url);
                } else if (!isUpdated) {
                    return true;
                }
            } else if (json[i].type == "dir") {
                await checkUpdates(json[i].path, download);
            }
        }
    } catch (err) {
        console.error(err);
        return false; // Change this to display error
    }
    return false;
}

makeFolder("./chats");

if (fs.existsSync(`./settings.json`)) {
    settings = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
} else {
    settings = {
        chatPort: 3000,
        ollamaPort: 11434,
        checkUpdates: true,
        https: false,
        network: false,
        password: false,
        themes: {
            light: [
                "#fff",
                "#eee",
                "#cdcdcd",
                "#b8b8b8",
                "#000",
                "#90cbff",
                "#f00",
            ],
            dark: [
                "#000",
                "#1d1d1d",
                "#323232",
                "#474747",
                "#fff",
                "#0e7dde",
                "#ff3d3d",
            ],
        },
    };
    writeFile("./settings.json", JSON.stringify(settings));
}

const proxy = createProxyServer();

app.use("/ollama", (req, res) => {
    proxy.web(req, res, { target: `http://127.0.0.1:${settings.ollamaPort}` });
});

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
    try {
        var ids = req.body;
        for (let i = 0; i < ids.length; i++) {
            if (fs.existsSync(`./chats/${ids[i]}.json`)) {
                fs.unlinkSync(`./chats/${ids[i]}.json`);
                console.log(`Deleting ./chats/${ids[i]}.json`);
            }
        }
        res.send(true);
    } catch (err) {
        console.error(err);
        res.send(false);
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

app.get("/api/updatecheck", async (req, res) => {
    const needUpdate = await checkUpdates();
    res.send(needUpdate);
});

app.get("/api/update", async (req, res) => {
    await checkUpdates("", true);
    res.send(true);
    console.log("Update complete, shutting down now.");
    process.exit();
});

app.post("/api/getsettings", async (req, res) => {
    res.send(JSON.stringify(settings));
});

app.post("/api/changesettings", (req, res) => {
    try {
        if (JSON.parse(req.body)) {
            settings = JSON.parse(req.body);
            res.send(true);
        }
        res.send(false);
    } catch (err) {
        console.error(err);
        res.send(false);
    }
});

var host = "127.0.0.1";
if (settings.network) {
    host = undefined;
}

if (settings.https) {
    const options = {
        key: fs.readFileSync("./certificate/key.pem"),
        cert: fs.readFileSync("./certificate/cert.pem"),
    };

    const server = https.createServer(options, app);

    server.listen(settings.chatPort, host, () => {
        console.log(
            `AwesomeChat running on https://127.0.0.1:${settings.chatPort}`,
        );
    });
} else {
    app.listen(settings.chatPort, host, () => {
        console.log(
            `AwesomeChat running on http://127.0.0.1:${settings.chatPort}`,
        );
    });
}
