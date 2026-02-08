var models;
// Add setting to disable title generation
var titleModel;
var activeModel;
var ollamaURL = "./ollama";
var chats = {};
var files = { text: {}, images: {} };
var activeChat = 0;
var temp = "";
var generating = false;
var openChat = true;
// Save current themes to cookie
var currentThemes = ["light", "dark"];
var settings = {
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

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("./service-worker.js")
        .then((registration) => {
            console.log("Service Worker registered:", registration);
        })
        .catch((error) => {
            console.log("Service Worker registration failed:", error);
        });
}

function changeTheme(t) {
    theme.innerText = `:root {--c1: ${t[0]};--c2: ${t[1]};--c3: ${t[2]}7d;--c4: ${t[2]};--c5: ${t[3]};--c6: ${t[4]};--c7: ${t[5]};--c8: ${t[6]}`;
}

function changeBuilderTheme(t) {
    buildertheme.innerText = `:root {--bc1: ${t[0]};--bc2: ${t[1]};--bc3: ${t[2]};--bc4: ${t[3]};--bc5: ${t[4]};--bc6: ${t[5]};--bc7: ${t[6]}`;
}

function autoTheme() {
    var id0 =
        Object.keys(settings.themes).indexOf(currentThemes[0]) + "_themeprev";
    var id1 =
        Object.keys(settings.themes).indexOf(currentThemes[1]) + "_themeprev";

    if (window.matchMedia("(prefers-color-scheme:dark)").matches) {
        changeTheme(settings.themes[currentThemes[1]]);
        if (document.getElementById(id1)) {
            document.getElementById(id1).style.border = "solid 2px var(--c7)";
        }
        if (document.getElementById(id0)) {
            document.getElementById(id0).style.border = "";
        }
    } else {
        changeTheme(settings.themes[currentThemes[0]]);
        if (document.getElementById(id0)) {
            document.getElementById(id0).style.border = "solid 2px var(--c7)";
        }
        if (document.getElementById(id1)) {
            document.getElementById(id1).style.border = "";
        }
    }
}
autoTheme();

window
    .matchMedia("(prefers-color-scheme:dark)")
    .addEventListener("change", autoTheme);

window.addEventListener("paste", async (event) => {
    const items = event.clipboardData.items;
    const dataTransfer = new DataTransfer();
    for (const item of items) {
        // remove if statement?
        if (item.type.startsWith("image/")) {
            dataTransfer.items.add(item.getAsFile());
        }
    }
    fileselect.files = dataTransfer.files;
    uploadFiles();
});

async function format(text) {
    // For LaTex formating ($\frac{6}{7}$ -> $ \frac{6}{7} $)
    text = text.replace(/(?<!\$)\$\s*([^$]+?)\s*\$(?!\$)/g, "$$$1$");
    const result = await convert(
        {
            from: "commonmark_x+tex_math_gfm-raw_html",

            to: "html5+raw_tex+tex_math_dollars+tex_math_double_backslash+tex_math_single_backslash",

            "html-math-method": "mathjax",
            standalone: false,
        },
        text,
    );
    return result.stdout;
}

async function generate(model, id, current) {
    var bodyJSON = JSON.stringify({
        model,
        messages: chats[current].messages,
    });
    if (models[model].capabilities.indexOf("thinking") != -1) {
        bodyJSON = JSON.stringify({
            model,
            messages: chats[current].messages,
            think: true,
        });
        chats[current].messages.push({
            role: "assistant",
            content: "",
            thinking: "",
        });
    } else {
        chats[current].messages.push({ role: "assistant", content: "" });
    }
    chats[current].modelList.push(activeModel);
    document.getElementById("name" + current).className =
        "chatselecttext loading";
    try {
        const response = await fetch(ollamaURL + "/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyJSON,
        });
        // idk if this first if statment is needed
        let data;
        if (response.bodyUsed && stopGen != true) {
            data = await response.text();
        } else if (stopGen != true) {
            try {
                var scrolledDown = true;
                const reader = response.body.getReader();
                let chunk;
                //generating = current;
                while (
                    (chunk = await reader.read({
                        encoding: "utf8",
                    })) !== null
                ) {
                    scrolledDown =
                        chatarea.scrollHeight -
                            chatarea.scrollTop -
                            chatarea.offsetHeight <
                        5;

                    // Process the generated text chunk by chunk
                    if (stopGen == true) {
                        stopGen = false;
                        generating = false;
                        break;
                    }
                    if (!chunk.value || generating == false) {
                        // redundant?
                        break;
                    }

                    var decoded = new TextDecoder().decode(chunk.value);
                    decoded = decoded.trim().split("\n");

                    // This is here because sometimes multiple chunks are sent at once
                    for (let i = 0; i < decoded.length; i++) {
                        if (JSON.parse(decoded[i]).message.thinking) {
                            chats[current].messages[
                                chats[current].messages.length - 1
                            ].thinking += JSON.parse(
                                decoded[i],
                            ).message.thinking;
                        } else {
                            chats[current].messages[
                                chats[current].messages.length - 1
                            ].content += JSON.parse(decoded[i]).message.content;
                        }
                    }

                    if (document.getElementById(id)) {
                        // innerHTML bad!! need to make parser that can dynamically add new elements + use innerText instead
                        // Mostly so that you can highlight items while chat is generating (currently not working D:)
                        if (
                            chats[current].messages[
                                chats[current].messages.length - 1
                            ].thinking
                        ) {
                            /*
                            if (!document.getElementById(`${id}_thinking`)) {
                                var thinkDiv = document.createElement("think");
                                thinkDiv.id = `${id}_thinking`;
                                document
                                    .getElementById(id)
                                    .appendChild(thinkDiv);
                            }
                            document.getElementById(
                                `${id}_thinking`,
                            ).innerHTML = format(
                                chats[current].messages[
                                    chats[current].messages.length - 1
                                ].thinking,
                            );
                            */
                            document.getElementById(id).innerHTML =
                                await format(
                                    "<details open=''><summary>Thinking</summary>\n\n" +
                                        chats[current].messages[
                                            chats[current].messages.length - 1
                                        ].thinking +
                                        "\n\n</details>\n\n" +
                                        chats[current].messages[
                                            chats[current].messages.length - 1
                                        ].content,
                                );
                        } else {
                            document.getElementById(id).innerHTML =
                                await format(
                                    chats[current].messages[
                                        chats[current].messages.length - 1
                                    ].content,
                                );
                        }

                        if (scrolledDown) {
                            chatarea.scrollTop =
                                chatarea.scrollHeight - chatarea.offsetHeight;
                        }
                        // For Latex Rendering
                        MathJax.typeset();
                    }
                }
            } catch (error) {
                newError("Chat Generation Error: " + error.message);
                console.error(error.message);
            }
        }
        document.getElementById("name" + current).className = "chatselecttext";
        // Change if statment cause model could just say "Loading model...", rare but possible
        if (
            document.getElementById(id) &&
            document.getElementById(id).innerText == "Loading model..."
        ) {
            document.getElementById(id).innerText = "";
        }
        saveChat(current);
        stopGen = false;
        generating = false;
        // Process the data once it's fully received (I think that I can remove this but idk)
        if (data) {
            const splitData = data.split("}");
            for (let i = 0; i < splitData.length - 1; i++) {
                const dataJson = JSON.parse(splitData[i] + "}");
                console.log("DOES THIS EVEN DO ANYTHING???");
                chats[current].messages[
                    chats[current].messages.length - 1
                ].content += dataJson.response;
                if (document.getElementById(id)) {
                    // innerHTML bad here too!!!
                    document.getElementById(id).innerHTML +=
                        await format(message);
                }
            }
            // For Latex Rendering
            MathJax.typeset();
        }
    } catch (error) {
        document.getElementById(id).innerHTML = "";
        document.getElementById("name" + current).className = "chatselecttext";
        generating = false;
        newError("Chat Generation Error: " + error.message);
        console.error(error.message);
    }
}

async function getTitle(id) {
    // Check if auto generated titles is off
    if (chats[id].messages[0].content == "") {
        setTitle(id, "Untitled Chat");
        return;
    }
    var body = {
        // Change to have model name from function?
        model: titleModel,
        prompt: `Condense the user's input to a maximum of 10 words.
If the input is already 10 words or less, output the original input verbatim.
Strictly adhere to these rules: do not provide answers, explanations, or any text beyond the condensed/original input.
Do not acknowledge the source of the input.
Do not mention the user in your output.
Begin immediately after this line:
${chats[id].messages[0].content.slice(0, 500)}`,
        stream: false,
    };
    if (models[titleModel].capabilities.indexOf("thinking") != -1) {
        body.think = false;
    }
    try {
        await fetch(ollamaURL + "/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Change this to a system prompt
            body: JSON.stringify(body),
        })
            .then((response) => response.json())
            .then((data) => {
                setTitle(id, data.response);
            });
    } catch (error) {
        setTitle(id, "Untitled Chat");
        newError("Title Generation Error: " + error.message);
        console.error(error.message);
    }
}

function setTitle(id, title) {
    chats[id].title = title.trim().replaceAll("\n", " ").slice(0, 200);
    document.getElementById("name" + id).innerText = chats[id].title.slice(
        0,
        29,
    );
    document.getElementById("name" + id).title = chats[id].title;
}

function addChat(id, selected, dateId) {
    var cdiv = document.createElement("div");
    cdiv.className = "chatselect";
    cdiv.id = "chat" + id;
    cdiv.setAttribute("onclick", `selectChat(${id})`);
    var cnamediv = document.createElement("div");
    cnamediv.className = "chatselecttext";
    cnamediv.id = "name" + id;
    if (chats[id].title != "") {
        cnamediv.innerText = chats[id].title.slice(0, 29);
    }
    cdiv.appendChild(cnamediv);
    var cinfodiv = document.createElement("div");
    cinfodiv.className = "chatselectinfo";
    if (selected) {
        cdiv.style.backgroundColor = "var(--c4)";
        cinfodiv.style.background =
            "linear-gradient(to right, rgba(0, 0, 0, 0), 10%, var(--c4))";
    }
    cinfodiv.setAttribute("onclick", `chatInfo(${id})`);
    for (let i = 0; i < 3; i++) {
        var newdiv = document.createElement("div");
        cinfodiv.appendChild(newdiv);
    }
    cdiv.appendChild(cinfodiv);
    if (dateId) {
        document.getElementById(dateId).appendChild(cdiv);
    } else {
        if (chatdatetoday.style.display == "none") {
            chatdatetoday.style.display = "";
        }
        chatsnow.appendChild(cdiv);
    }
}

var chatIndex = -1;
async function send() {
    if (
        generating ||
        (textbox.value.trim() == "" &&
            Object.keys(files.text).length == 0 &&
            !models[activeModel].capabilities.includes("vision")) ||
        (textbox.value.trim() == "" &&
            Object.values(files.images).length == 0 &&
            Object.keys(files.text).length == 0 &&
            models[activeModel].capabilities.includes("vision"))
    ) {
        return;
    }
    if (activeChat == 0) {
        activeChat = new Date().getTime();
        chats[activeChat] = {};
        temp = "";
        chats[activeChat].temp = "";
        chats[activeChat].title = "";
        chats[activeChat].messages = [];
        chats[activeChat].modelList = [];
        addChat(activeChat, true);
    }
    generating = activeChat;
    chatIndex++;
    newchatmsg.style.display = "none";
    // User message
    var userdiv = document.createElement("div");
    userdiv.className = "userchat";
    userdiv.id = "user" + activeChat + "_" + chatIndex;
    var usercontent = textbox.value.trim();
    for (let i = 0; i < Object.keys(files.text).length; i++) {
        var filename = Object.keys(files.text)[i];
        if (filename.indexOf("\\") != -1) {
            filename = filename.split("\\")[0];
        }
        var ext = "";
        if (filename.includes(".")) {
            ext = filename.split(".")[filename.split(".").length - 1];
        }
        usercontent += `\n${filename}\n\`\`\`${ext}\n${files.text[Object.keys(files.text)[i]]}\n\`\`\``;
        removeFile("txt", i);
    }
    usercontent = usercontent.trim();
    if (
        models[activeModel].capabilities.includes("vision") &&
        Object.values(files.images).length > 0
    ) {
        const imgs = [];
        for (let i = 0; i < Object.values(files.images).length; i++) {
            const img = Object.values(files.images)[i];
            if (img != false) {
                imgs.push(img.slice(img.lastIndexOf(",") + 1));
                removeFile("img", i);
            }
        }
        chats[activeChat].messages.push({
            role: "user",
            content: usercontent,
            images: imgs,
        });
        const imgsdiv = document.createElement("div");
        imgsdiv.className = "chatimages";
        imgsdiv.id = "imgs" + activeChat + "_" + chatIndex;
        const imgsinnerdiv = document.createElement("div");
        for (let i = 0; i < imgs.length; i++) {
            const image = document.createElement("img");
            image.src = "data:image;base64," + imgs[i];
            imgsinnerdiv.appendChild(image);
        }
        imgsdiv.appendChild(imgsinnerdiv);
        chatarea.appendChild(imgsdiv);
    } else {
        chats[activeChat].messages.push({
            role: "user",
            content: usercontent,
        });
    }
    userdiv.innerText = usercontent;
    textbox.value = "";
    resizeInput();
    sendbttn.style.display = "none";
    stopbttn.style.display = "";
    chatarea.appendChild(userdiv);
    // User info under user message
    var chatinfodiv = document.createElement("div");
    chatinfodiv.className = "chatinfo";
    chatinfodiv.id = "userinfo" + activeChat + "_" + chatIndex;
    chatinfodiv.style.justifyContent = "end";
    var copydiv = document.createElement("div");
    copydiv.appendChild(createCopySvg());
    copydiv.setAttribute(
        "onclick",
        `copyChat(${activeChat + ", " + (chats[activeChat].messages.length - 1)})`,
    );
    chatinfodiv.appendChild(copydiv);
    var editdiv = document.createElement("div");
    editdiv.appendChild(createEditSvg());
    editdiv.setAttribute(
        "onclick",
        `editUserText(${activeChat + ", " + (chats[activeChat].messages.length - 1)})`,
    );
    chatinfodiv.appendChild(editdiv);
    chatarea.appendChild(chatinfodiv);
    // Chat message
    var aidiv = document.createElement("div");
    aidiv.className = "aichat";
    aidiv.id = "ai" + activeChat + "_" + chatIndex;
    var ldiv = document.createElement("div");
    ldiv.className = "loading";
    ldiv.innerText = "Loading model...";
    aidiv.appendChild(ldiv);
    chatarea.appendChild(aidiv);
    // Chat info under message
    var infodiv = document.createElement("div");
    infodiv.className = "chatinfo";
    infodiv.id = "info" + activeChat + "_" + chatIndex;
    var mnamediv = document.createElement("div");
    mnamediv.innerText = activeModel;
    mnamediv.className = "modelchange";
    mnamediv.setAttribute(
        "onclick",
        `showChangeModel(${activeChat + ", " + chats[activeChat].messages.length})`,
    );
    infodiv.appendChild(mnamediv);
    copydiv = document.createElement("div");
    copydiv.appendChild(createCopySvg());
    copydiv.setAttribute(
        "onclick",
        `copyChat(${activeChat + ", " + chats[activeChat].messages.length})`,
    );
    infodiv.appendChild(copydiv);
    var redodiv = document.createElement("div");
    redodiv.appendChild(createRedoSvg());
    redodiv.setAttribute(
        "onclick",
        `redoChat(${activeChat + ", " + chats[activeChat].messages.length})`,
    );
    infodiv.appendChild(redodiv);
    chatarea.appendChild(infodiv);

    chatarea.scrollTop = chatarea.scrollHeight - chatarea.offsetHeight;
    if (chats[activeChat].title == "") {
        await getTitle(activeChat);
    }
    await generate(
        activeModel,
        "ai" + activeChat + "_" + chatIndex,
        activeChat,
    );
    sendbttn.style.display = "";
    stopbttn.style.display = "none";
}

function copyChat(id, index) {
    navigator.clipboard.writeText(chats[id].messages[index].content);
}

var stopGen = false;

function stopChat() {
    if (generating) {
        stopGen = true;
    }
}

async function redoChat(id, index) {
    if (generating) {
        return;
    }
    for (let i = (index - 1) / 2 + 1; i < chats[id].messages.length / 2; i++) {
        removeElement("imgs" + activeChat + "_" + i);
        removeElement("user" + activeChat + "_" + i);
        removeElement("ai" + activeChat + "_" + i);
        removeElement("info" + activeChat + "_" + i);
        removeElement("userinfo" + activeChat + "_" + i);
        chatIndex--;
    }
    chats[id].messages = chats[id].messages.slice(0, index);
    sendbttn.style.display = "none";
    stopbttn.style.display = "";
    var ldiv = document.createElement("div");
    ldiv.className = "loading";
    ldiv.innerText = "Loading model...";
    document.getElementById(`ai${id}_${(index - 1) / 2}`).innerText = "";
    document.getElementById(`ai${id}_${(index - 1) / 2}`).appendChild(ldiv);
    generating = activeChat;
    var cModel = chats[id].modelList[(index - 1) / 2];
    chats[id].modelList = chats[id].modelList.slice(0, (index - 1) / 2);
    await generate(cModel, `ai${id}_${(index - 1) / 2}`, id);
    sendbttn.style.display = "";
    stopbttn.style.display = "none";
}

function createFileSVG() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("viewBox", "-0.5 -10.5 8 11");
    svg.setAttribute("style", "width: 100px");

    const pathsData = [
        "M0-1 0-9C0-10 0-10 1-10L5-10 7-8 7-1C7 0 7 0 6 0L1 0C0 0 0 0 0-1",
        "M5-10 5-8.5C5-8 5-8 5.5-8L7-8",
        "M1-9 3-9",
        "M1-8 4-8",
        "M1-7 4-7",
        "M1-6 6-6",
        "M2-5 6-5",
        "M1-4 6-4",
        "M1-4 6-4",
        "M1-3 6-3",
        "M1-2 5-2",
        "M2-1 6-1",
    ];

    for (let i = 0; i < pathsData.length; i++) {
        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
        );
        path.setAttribute("d", pathsData[i]);
        if (i < 2) {
            path.setAttribute("stroke", "var(--c6)");
        } else {
            path.setAttribute("stroke", "var(--c5)");
        }
        path.setAttribute("stroke-width", "0.5");
        path.setAttribute("fill", "none");
        svg.appendChild(path);
    }

    return svg;
}

function removeFile(type, num) {
    removeElement(type + num);
    if (type == "img") {
        files.images[Object.keys(files.images)[num]] = false;
    } else {
        files.text[Object.keys(files.text)[num]] = false;
    }
    const imageValues = Object.values(files.images);
    var imgEmpty = true;
    for (let i = 0; i < imageValues.length; i++) {
        if (imageValues[i] != false) {
            imgEmpty = false;
        }
    }
    if (imgEmpty) {
        files.images = {};
    }
    const textValues = Object.values(files.text);
    var txtEmpty = true;
    for (let i = 0; i < textValues.length; i++) {
        if (textValues[i] != false) {
            txtEmpty = false;
        }
    }
    if (txtEmpty) {
        files.text = {};
    }
}

function createFile(name, url) {
    const fdiv = document.createElement("div");
    fdiv.className = "filediv";
    const fclose = document.createElement("div");
    fclose.className = "fileclose";
    fclose.appendChild(document.createElement("div"));
    const xdiv = document.createElement("div");
    xdiv.style.transform = "rotate(-45deg)";
    fclose.appendChild(xdiv);
    fdiv.appendChild(fclose);
    if (url) {
        fdiv.id = "img" + Object.keys(files.images).length;
        fclose.setAttribute(
            "onclick",
            `removeFile("img", ${Object.keys(files.images).length})`,
        );
        const fimg = document.createElement("img");
        fimg.src = url;
        fdiv.appendChild(fimg);
    } else {
        fdiv.id = "txt" + Object.keys(files.text).length;
        fclose.setAttribute(
            "onclick",
            `removeFile("txt", ${Object.keys(files.text).length})`,
        );
        fdiv.appendChild(createFileSVG());
    }
    const fname = document.createElement("div");
    fname.style.paddingTop = "5px";
    if (name.indexOf("\\") != -1) {
        name = name.split("\\")[0];
    }
    if (name.length > 13) {
        name = name.slice(0, 5) + "..." + name.slice(-5);
    }
    fname.innerText = name;
    fdiv.appendChild(fname);
    filescontainer.appendChild(fdiv);
}

function uploadFiles() {
    if (fileselect.files.length == 0) {
        return;
    }
    for (let i = 0; i < fileselect.files.length; i++) {
        const file = fileselect.files[i];
        const reader = new FileReader();
        // If file name already in list it adds current time to name
        var filename = file.name;
        if (
            (Object.keys(files.text).includes(file.name) &&
                files.text[file.name]) ||
            (Object.keys(files.images).includes(file.name) &&
                files.images[file.name])
        ) {
            filename = file.name + "\\" + Date.now();
        }
        // Checks if file name is already in files
        // but if a file is deleted the file name is kept (need to check why this is the case)
        // So if a file name is already in files but no file is there it gets over written
        // I think this if statement is not needed anymore because of the one above
        if (
            (!Object.keys(files.text).includes(filename) ||
                !files.text[filename]) &&
            (!Object.keys(files.images).includes(filename) ||
                !files.images[filename])
        ) {
            if (file.type.split("/")[0] == "image") {
                if (models[activeModel].capabilities.includes("vision")) {
                    reader.addEventListener(
                        "load",
                        () => {
                            createFile(filename, URL.createObjectURL(file));
                            files.images[filename] = reader.result;
                        },
                        false,
                    );
                    reader.readAsDataURL(file);
                }
            } else {
                // (file.type.split("/")[0] == "text") I give up on text validation
                reader.addEventListener(
                    "load",
                    () => {
                        createFile(filename);
                        let utf8decoder = new TextDecoder();
                        files.text[filename] = utf8decoder.decode(
                            reader.result,
                        );
                    },
                    false,
                );
                reader.readAsArrayBuffer(file);
            }
        }
    }
}

async function getModels() {
    try {
        var modelrequest = await fetch(ollamaURL + "/api/tags")
            .then((response) => response.json())
            .then((data) => {
                var modelnames = {};
                for (let i = 0; i < data.models.length; i++) {
                    if (data.models[i].model.split(":")[1] == "latest") {
                        data.models[i].model =
                            data.models[i].model.split(":")[0];
                    }
                    modelnames[data.models[i].model] = {};
                    modelnames[data.models[i].model]["parameterSize"] =
                        data.models[i].details.parameter_size;
                    modelnames[data.models[i].model]["size"] =
                        data.models[i].size;
                }
                return modelnames;
            });
        return modelrequest;
    } catch (error) {
        newError("Fetching Models Error: " + error.message);
        console.error(error.message);
    }
}

async function getModelData(model) {
    try {
        var request = await fetch(ollamaURL + "/api/show", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: model }),
        })
            .then((response) => response.json())
            .then((data) => {
                return data.capabilities;
            });
        return request;
    } catch (error) {
        newError("Model Info Error: " + error.message);
        console.error(error.message);
    }
}

function formatBites(num) {
    if (num > 1000000000) {
        return Math.round(num / 1000000000) + "GB";
    } else if (num > 1000000) {
        return Math.round(num / 1000000) + "MB";
    } else if (num > 1000) {
        return Math.round(num / 1000) + "KB";
    } else {
        return num + " Bites";
    }
}

function removeElement(id) {
    if (document.getElementById(id)) {
        document.getElementById(id).remove();
    }
}

function newChat() {
    history.pushState(null, "", "./");
    if (sidebar.style.zIndex == 2 && sidebar.style.display != "none") {
        toggleSideBar();
    }
    if (activeChat != 0) {
        for (let i = 0; i < chats[activeChat].messages.length / 2; i++) {
            removeElement("imgs" + activeChat + "_" + i);
            removeElement("user" + activeChat + "_" + i);
            removeElement("ai" + activeChat + "_" + i);
            removeElement("info" + activeChat + "_" + i);
            removeElement("userinfo" + activeChat + "_" + i);
        }
    }
    chatIndex = -1;
    newchatmsg.style.display = "";
    activeChat = 0;
    textbox.value = temp;
    resizeInput();
    if (sidebar.style.zIndex != 2) {
        textbox.focus();
    }
    var allChats = document.getElementsByClassName("chatselect");
    for (let i = 1; i < allChats.length; i++) {
        allChats[i].style.backgroundColor = "";
        allChats[i].getElementsByClassName(
            "chatselectinfo",
        )[0].style.background = "";
    }
}

function newError(text) {
    console.log(text);
    const errDiv = document.createElement("div");
    errDiv.id = "error" + errorsdiv.children.length;
    const errName = document.createElement("div");
    errName.innerText = text;
    errDiv.appendChild(errName);
    const errClose = document.createElement("div");
    errClose.className = "errorclose";
    errClose.setAttribute("onclick", `removeElement(${errDiv.id})`);
    const errCloseDiv = document.createElement("div");
    errCloseDiv.style.width = "12px";
    errCloseDiv.style.position = "absolute";
    errCloseDiv.style.transform = "rotate(-45deg)";
    errClose.appendChild(errCloseDiv);
    errClose.appendChild(document.createElement("div"));
    errDiv.appendChild(errClose);
    errorsdiv.appendChild(errDiv);
    setTimeout(function () {
        removeElement(errDiv.id);
    }, 30000);
}

function createCopySvg() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("viewBox", "-1 -4.5 15 15");
    svg.setAttribute("style", "width: 15px; height: 15px;");

    const path1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
    );
    path1.setAttribute(
        "d",
        "M2 0C1 0 0 1 0 2L0 7C0 8 1 9 2 9L8 9C9 9 10 8 10 7L10 2C10 1 9 0 8 0L2 0",
    );
    path1.setAttribute("fill", "none");
    path1.setAttribute("stroke-width", "1.2");
    path1.setAttribute("stroke", "var(--c6)");

    const path2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
    );
    path2.setAttribute(
        "d",
        "M3 0 3-1C3-2 4-3 5-3L11-3C12-3 13-2 13-1L13 5C13 6 12 7 11 7L10 7",
    );
    path2.setAttribute("fill", "none");
    path2.setAttribute("stroke-width", "1.2");
    path2.setAttribute("stroke", "var(--c6)");

    svg.appendChild(path1);
    svg.appendChild(path2);

    return svg;
}

function createRedoSvg() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "-1.5 -6.5 13 13");
    svg.setAttribute("style", "width: 15px; height: 15px;");

    const path1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
    );
    path1.setAttribute("d", "M0 1C1 7 9 7 10 1");
    path1.setAttribute("stroke", "var(--c6)");
    path1.setAttribute("stroke-width", "1");
    path1.setAttribute("fill", "none");
    svg.appendChild(path1);

    const path2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
    );
    path2.setAttribute("d", "M8 2 10 1 11 3");
    path2.setAttribute("stroke", "var(--c6)");
    path2.setAttribute("stroke-width", "1");
    path2.setAttribute("fill", "none");
    svg.appendChild(path2);

    const path3 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
    );
    path3.setAttribute("d", "M10-1C9-7 1-7-0-1");
    path3.setAttribute("stroke", "var(--c6)");
    path3.setAttribute("stroke-width", "1");
    path3.setAttribute("fill", "none");
    svg.appendChild(path3);

    const path4 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
    );
    path4.setAttribute("d", "M2-2-0-1-1-3");
    path4.setAttribute("stroke", "var(--c6)");
    path4.setAttribute("stroke-width", "1");
    path4.setAttribute("fill", "none");
    svg.appendChild(path4);

    return svg;
}

function createEditSvg() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "-5.9333 -2.2291 6.662 6.662");
    svg.setAttribute("style", "width: 15px; height: 15px;");

    const path1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
    );
    path1.setAttribute(
        "d",
        "M-.0607-.0251A1 1 45 00-1.4749-1.4393L-5.0104 2.0962C-5.7175 4.2175-5.7175 4.2175-3.5962 3.5104L-.0607-.0251",
    );
    path1.setAttribute("stroke", "var(--c6)");
    path1.setAttribute("stroke-width", "0.5");
    path1.setAttribute("fill", "none");
    svg.appendChild(path1);

    const path2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
    );
    path2.setAttribute("d", "M-1.4749-1.4393-.0607-.0251");
    path2.setAttribute("stroke", "var(--c6)");
    path2.setAttribute("stroke-width", "0.5");
    path2.setAttribute("fill", "none");
    svg.appendChild(path2);

    return svg;
}

async function selectChat(id) {
    if (activeChat == id) {
        return;
    }
    if (sidebar.style.zIndex == 2 && sidebar.style.display != "none") {
        toggleSideBar();
    }
    if (activeChat != 0) {
        for (let i = 0; i < chats[activeChat].messages.length / 2; i++) {
            removeElement("imgs" + activeChat + "_" + i);
            removeElement("user" + activeChat + "_" + i);
            removeElement("ai" + activeChat + "_" + i);
            removeElement("info" + activeChat + "_" + i);
            removeElement("userinfo" + activeChat + "_" + i);
        }
    }
    // Change URL
    var url = new URL(window.location.href);
    url.searchParams.set("chat", id);
    history.pushState(null, "", url.toString());
    activeChat = id;
    textbox.value = chats[activeChat].temp;
    resizeInput();
    if (sidebar.style.zIndex != 2) {
        textbox.focus();
    }
    const lastModel =
        chats[activeChat].modelList[chats[activeChat].modelList.length - 1];
    if (Object.keys(models).indexOf(lastModel) != -1) {
        selectModel(lastModel);
    }
    chatIndex = chats[activeChat].messages.length / 2 - 1;
    newchatmsg.style.display = "none";
    var allChats = document.getElementsByClassName("chatselect");
    for (let i = 1; i < allChats.length; i++) {
        if (allChats[i].id == "chat" + id) {
            allChats[i].style.backgroundColor = "var(--c4)";
            allChats[i].getElementsByClassName(
                "chatselectinfo",
            )[0].style.background =
                "linear-gradient(to right, rgba(0, 0, 0, 0), 10%, var(--c4))";
        } else {
            allChats[i].style.backgroundColor = "";
            allChats[i].getElementsByClassName(
                "chatselectinfo",
            )[0].style.background = "";
        }
    }
    var index = 0;
    for (let i = 0; i < chats[activeChat].messages.length; i++) {
        if (i % 2 == 0 && i != 0) {
            index++;
        }
        var chat = chats[activeChat].messages[i];
        var div = document.createElement("div");
        if (chat.role == "user") {
            if (chat.images) {
                const imgsdiv = document.createElement("div");
                imgsdiv.className = "chatimages";
                imgsdiv.id = "imgs" + activeChat + "_" + index;
                const imgsinnerdiv = document.createElement("div");
                for (let j = 0; j < chat.images.length; j++) {
                    const image = document.createElement("img");
                    image.src = "data:image;base64," + chat.images[j];
                    imgsinnerdiv.appendChild(image);
                }
                imgsdiv.appendChild(imgsinnerdiv);
                chatarea.appendChild(imgsdiv);
            }
            div.className = "userchat";
            div.id = "user" + activeChat + "_" + index;
            div.innerText = chat.content;
        } else {
            div.className = "aichat";
            div.id = "ai" + activeChat + "_" + index;
            if (
                generating &&
                i == chats[activeChat].messages.length - 1 &&
                chat.content == ""
            ) {
                var ldiv = document.createElement("div");
                ldiv.className = "loading";
                ldiv.innerText = "Loading model...";
                div.appendChild(ldiv);
            } else {
                if (chat.thinking) {
                    div.innerHTML = await format(
                        "<details><summary>Thinking</summary>\n\n" +
                            chat.thinking +
                            "\n\n</details>\n\n" +
                            chat.content,
                    );
                } else {
                    div.innerHTML = await format(chat.content);
                }
            }
        }
        chatarea.appendChild(div);
        // Chat info
        var infodiv = document.createElement("div");
        infodiv.className = "chatinfo";
        if (i % 2 != 0) {
            infodiv.id = "info" + activeChat + "_" + index;
            var mnamediv = document.createElement("div");
            mnamediv.innerText = chats[id].modelList[index];
            mnamediv.setAttribute(
                "onclick",
                `showChangeModel(${activeChat + ", " + i})`,
            );
            mnamediv.className = "modelchange";
            infodiv.appendChild(mnamediv);
            var copydiv = document.createElement("div");
            copydiv.appendChild(createCopySvg());
            copydiv.setAttribute(
                "onclick",
                `copyChat(${activeChat + ", " + i})`,
            );
            infodiv.appendChild(copydiv);
            var redodiv = document.createElement("div");
            redodiv.appendChild(createRedoSvg());
            redodiv.setAttribute(
                "onclick",
                `redoChat(${activeChat + ", " + i})`,
            );
            infodiv.appendChild(redodiv);
        } else {
            infodiv.id = "userinfo" + activeChat + "_" + index;
            infodiv.style.justifyContent = "end";
            var copydiv = document.createElement("div");
            copydiv.appendChild(createCopySvg());
            copydiv.setAttribute(
                "onclick",
                `copyChat(${activeChat + ", " + i})`,
            );
            infodiv.appendChild(copydiv);
            var editdiv = document.createElement("div");
            editdiv.appendChild(createEditSvg());
            editdiv.setAttribute(
                "onclick",
                `editUserText(${activeChat + ", " + i})`,
            );
            infodiv.appendChild(editdiv);
        }
        chatarea.appendChild(infodiv);
    }
    chatarea.scrollTop = chatarea.scrollHeight - chatarea.offsetHeight;
    // For Latex Rendering
    MathJax.typeset();
}

function stopClick() {
    if (!e) {
        var e = window.event;
    }
    e.cancelBubble = true;
    if (e.stopPropagation) {
        e.stopPropagation();
    }
}

function chatInfo(id) {
    stopClick();
    changeChatTitle();
    if (
        chatinfodiv.style.display != "none" &&
        parseInt(chatinfosave.attributes.onclick.nodeValue.slice(9, -1)) == id
    ) {
        chatinfodiv.style.display = "none";
        return;
    }
    if (modelselectlist.style.display == "") {
        toggleList();
    }
    var y = event.clientY + 10;
    // 112 is the computed height of the chatinfodiv element
    if (y + 112 >= document.body.offsetHeight) {
        y = document.body.offsetHeight - 112;
    }
    chatinfodiv.style.left = event.clientX - 10 + "px";
    chatinfodiv.style.top = y + "px";
    chatinfosave.setAttribute("onclick", `saveChat(${id})`);
    chatinfodel.setAttribute("onclick", `removeChat(${id})`);
    chatinforename.setAttribute("onclick", `renameChat(${id})`);
    chatinfodiv.style.display = "";
}

function showChangeModel(id, index) {
    for (let i = 0; i < modelchangelist.children.length; i++) {
        modelchangelist.children[i].setAttribute(
            "onclick",
            `changeModel("${modelchangelist.children[i].innerText}", ${id}, ${index})`,
        );
    }
    modelchangelist.style.display = "";

    var element =
        document.getElementsByClassName("modelchange")[(index - 1) / 2];

    modelchangelist.style.left = element.offsetLeft + "px";
    modelchangelist.style.top =
        element.offsetTop -
        modelchangelist.offsetHeight -
        chatarea.scrollTop +
        "px";
}

function changeModel(model, id, index) {
    if (generating) {
        return;
    }
    document.getElementsByClassName("modelchange")[(index - 1) / 2].innerText =
        model;
    chats[id].modelList[(index - 1) / 2] = model;
    modelchangelist.style.display = "none";
    selectModel(model);
    redoChat(id, index);
}

function chatScroll() {
    if (modelchangelist.style.display != "none") {
        var i =
            (parseInt(
                modelchangelist.children[0].attributes[0].value
                    .split(" ")
                    .pop()
                    .slice(0, -1),
            ) -
                1) /
            2; // This is cursed and I probably should change it?
        modelchangelist.style.top =
            document.getElementsByClassName("modelchange")[i].offsetTop -
            modelchangelist.offsetHeight -
            chatarea.scrollTop +
            "px";
    }
}

async function removeChat(id) {
    stopChat();
    const response = await deleteChat(id);
    if (!response) {
        newError(`Unable to Delete Chat (ID: ${id})`);
        return;
    }
    if (activeChat == id) {
        newChat();
    }
    removeElement("chat" + id);
    delete chats[id];
}

function renameChat(id) {
    document.getElementById("name" + id).innerText = "";
    var reinput = document.createElement("textarea");
    reinput.id = "renameinput";
    reinput.placeholder = "Type here...";
    reinput.value = chats[id].title;
    document.getElementById("name" + id).appendChild(reinput);
    renameinput.focus();
}

function cancelUserEdit() {
    if (!document.getElementById("editmessage")) {
        return;
    }
    const id = parseInt(editmessage.parentNode.id.slice(4));
    const index = parseInt(editmessage.parentNode.id.split("_").pop()) * 2;
    editmessage.parentNode.style = "";
    editmessage.parentNode.innerText = chats[id].messages[index].content;
}

function sendUserEdit() {
    if (!document.getElementById("editmessage")) {
        return;
    }
    const id = parseInt(editmessage.parentNode.id.slice(4));
    const index = parseInt(editmessage.parentNode.id.split("_").pop()) * 2;
    editmessage.parentNode.style = "";
    chats[id].messages[index].content = editmessage.value;
    editmessage.parentNode.innerText = editmessage.value;
    redoChat(id, index + 1);
}

function editUserText(id, index) {
    if (document.getElementById("editmessage")) {
        cancelUserEdit();
    }
    const userMessage = document.getElementById("user" + id + "_" + index / 2);
    userMessage.style.minWidth = userMessage.offsetWidth - 20 + "px";
    userMessage.style.minHeight = 37 + userMessage.offsetHeight + "px";
    userMessage.innerText = "";
    const messageInput = document.createElement("textarea");
    messageInput.id = "editmessage";
    messageInput.value = chats[id].messages[index].content;
    userMessage.appendChild(messageInput);
    const messageOptions = document.createElement("div");
    messageOptions.className = "editoptions";
    const cancelBttn = document.createElement("div");
    cancelBttn.innerText = "Cancel";
    cancelBttn.style.backgroundColor = "var(--c8)";
    cancelBttn.setAttribute("onclick", "cancelUserEdit()");
    messageOptions.appendChild(cancelBttn);
    const sendBttn = document.createElement("div");
    sendBttn.innerText = "Send";
    sendBttn.setAttribute("onclick", "sendUserEdit()");
    messageOptions.appendChild(sendBttn);
    userMessage.appendChild(messageOptions);
}

function changeChatTitle() {
    if (!document.getElementById("renameinput")) {
        return;
    } else if (document.getElementById("renameinput").value == "") {
        renameinput.parentNode.innerText = chats[
            parseInt(renameinput.parentNode.id.slice(4))
        ].title.slice(0, 29);
        return;
    }
    chats[parseInt(renameinput.parentNode.id.slice(4))].title =
        renameinput.value;
    saveChat(parseInt(renameinput.parentNode.id.slice(4)));
    renameinput.parentNode.title = renameinput.value;
    renameinput.parentNode.innerText = renameinput.value.slice(0, 29);
}

function toggleList() {
    if (modelselectlist.style.display == "none") {
        ddsvg.style.transform = "rotate(180deg)";
        modelselectlist.style.display = "";
    } else {
        ddsvg.style.transform = "";
        modelselectlist.style.display = "none";
    }
}

function toggleSwitch(self, mode) {
    if (self.style.length != 0 || mode == "off") {
        // Turn off
        self.style = "";
        self.children[0].style = "";
        self.setAttribute("value", "false");
        if (self.id == "sttngs_password") {
            changepass.style.display = "none";
            createpass.style.display = "none";
        }
    } else {
        // Turn on
        self.style.backgroundColor = "var(--c7)";
        self.style.border = "2px solid var(--c7)";
        self.children[0].style.marginLeft = "20px";
        self.setAttribute("value", "true");
        if (self.id == "sttngs_password") {
            if (settings.password) {
                changepass.style.display = "";
            } else {
                createpass.style.display = "";
            }
        }
    }
    settingsChange(self);
}

document.addEventListener("mousedown", function (event) {
    if (event.target.id == "settingsbg") {
        settingsbg.style.display = "none";
    }
});

document.addEventListener("click", function (event) {
    var id = event.target.id;
    var pid = event.target.parentNode.id;
    var msl = ["modelselect", "modelselectlist", "modelselectlist", "ddsvg"];
    if (
        msl.indexOf(id) == -1 &&
        msl.indexOf(pid) == -1 &&
        modelselectlist.style.display != "none"
    ) {
        toggleList();
    }
    if (event.target.className != "chatselectinfo") {
        chatinfodiv.style.display = "none";
    }
    if (
        document.getElementById("renameinput") &&
        id != "renameinput" &&
        id != "chatinforename"
    ) {
        changeChatTitle();
    }
    if (
        modelchangelist.style.display != "none" &&
        id != "modelchangelist" &&
        pid != "modelchangelist" &&
        event.target.className != "modelchange"
    ) {
        modelchangelist.style.display = "none";
    }
});

function toggleSideBar() {
    if (sidebarbttn.style.display == "none") {
        filescontainer.style.maxWidth = "100%";
        fileselectscreen.style.width = "100%";
        sidebarbttn.style.display = "";
        sidebar.style.display = "none";
        modelselectlist.style.left = "50px";
    } else {
        filescontainer.style.maxWidth = "";
        fileselectscreen.style.width = "";
        sidebarbttn.style.display = "none";
        sidebar.style.display = "";
        modelselectlist.style.left = "";
    }
}

function updateCookie(model, themes) {
    const d = new Date();
    d.setTime(d.getTime() + 31536000000); // 1 year
    document.cookie =
        "lastModel=;expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
    document.cookie =
        "currentThemes=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";

    document.cookie = `lastModel=${model};expires=${d.toUTCString()};path=/`;

    document.cookie = `currentThemes=${btoa(JSON.stringify(themes)).replaceAll("=", "")};expires=${d.toUTCString()};path=/`;
}

function getCookie() {
    var cookie = document.cookie.replaceAll(" ", "").split(";");
    if (cookie.length < 2) {
        return false;
    }
    var cookieJSON = {};
    for (let i = 0; i < cookie.length; i++) {
        cookie[i] = cookie[i].split("=");
        cookieJSON[cookie[i][0]] = cookie[i][1];
    }
    return cookieJSON;
}

function selectModel(name) {
    activeModel = name;
    modelname.innerText = name;
    updateCookie(name, currentThemes);
    if (models[name].capabilities.includes("vision")) {
        fileselectinfo.innerText = "(Text Files and Images Supported)";
    } else {
        fileselectinfo.innerText = "(Text Files Supported)";
        for (let i = 0; i < Object.keys(files.images).length; i++) {
            removeFile("img", i);
        }
    }
}

function resizeInput() {
    if (activeChat != 0 && chats[activeChat].temp != textbox.value) {
        chats[activeChat].temp = textbox.value;
    } else if (activeChat == 0 && temp != textbox.value) {
        temp = textbox.value;
    }
    var amount = 0;
    amount += textbox.value.split("\n").length;
    for (let i = 0; i < textbox.value.split("\n").length; i++) {
        var line = textbox.value.split("\n")[i];
        if (line.length > Math.ceil(textbox.offsetWidth / 10) - 1) {
            amount +=
                Math.ceil(
                    line.length / (Math.ceil(textbox.offsetWidth / 10) - 1),
                ) - 1;
        }
    }
    amount -= 1;
    if (amount > 0 && 55 + 19 * amount < document.body.offsetHeight / 2) {
        chatinput.style.height = 55 + 19 * amount + "px";
        chatarea.style.paddingBottom = chatinput.offsetHeight + 23 + "px";
    } else if (
        amount != 0 &&
        55 + 19 * amount > document.body.offsetHeight / 2
    ) {
        chatinput.style.height =
            Math.round(document.body.offsetHeight / 2) + "px";
        chatarea.style.paddingBottom = chatinput.offsetHeight + 23 + "px";
    } else if (amount == 0) {
        chatinput.style.height = "";
        chatarea.style.paddingBottom = "";
    }
}

function mobile() {
    if (
        document.body.offsetWidth < document.body.offsetHeight &&
        sidebar.style.zIndex != "2"
    ) {
        if (sidebar.style.display != "none") {
            toggleSideBar();
        }
        sidebar.style.position = "absolute";
        sidebar.style.left = "0";
        sidebar.style.zIndex = "2";
        sidebar.style.boxShadow = "0px 0px 15px var(--c4)";
    } else if (
        document.body.offsetWidth >= document.body.offsetHeight &&
        sidebar.style.zIndex == "2"
    ) {
        if (sidebar.style.display == "none") {
            toggleSideBar();
        }
        sidebar.style = "";
    }
    if (document.body.offsetWidth < 800 && settingsexit.style.right == "") {
        settingsexit.style.marginLeft = "5px";
        settingsexit.style.right = "0px";
    } else if (
        document.body.offsetWidth > 799 &&
        settingsexit.style.right != ""
    ) {
        settingsexit.style = "";
    }
}
setTimeout(function () {
    // will not work without setTimeout and idk why
    mobile();
    textbox.value = "";
}, 0);

window.onresize = function () {
    resizeInput();
    mobile();
    if (modelchangelist.style.display != "none") {
        modelchangelist.style.display = "none";
    }
};

async function sendHTML(html) {
    try {
        await fetch("/api/htmlviewer", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ html: html }),
        });
    } catch (error) {
        newError("HTML Preview Error: " + error.message);
        console.error(error.message);
    }
}

var cmdPressed = [false, false];
// Meta is Command on Mac but Windows key on Windows
document.addEventListener("keydown", function (event) {
    if (event.key == "Meta") {
        cmdPressed[0] = true;
    } else if (event.key == "Control") {
        cmdPressed[1] = true;
    } else if (event.key == "Enter") {
        // Check if focused on text input?
        if (cmdPressed[0] || cmdPressed[1]) {
            send();
        } else {
            changeChatTitle();
        }
    }
});

document.addEventListener("keyup", function (event) {
    if (event.key == "Meta") {
        cmdPressed[0] = false;
    } else if (event.key == "Control") {
        cmdPressed[1] = false;
    }
});

async function saveChat(id) {
    var chatJson = "";
    if (id) {
        var obj = {};
        obj[id] = chats[id];
        chatJson = JSON.stringify(obj);
    } else {
        chatJson = JSON.stringify(chats);
    }
    try {
        await fetch("/api/savechats", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: chatJson,
        });
    } catch (error) {
        newError("Error Saving Chat: " + error.message);
        console.error(error.message);
    }
}

async function deleteChat(id) {
    if (!id.length) {
        id = [id];
    }
    try {
        const response = await fetch("/api/deletechats", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(id),
        });
        const json = await response.json();
        return json;
    } catch (error) {
        newError("Error Deleting Chat: " + error.message);
        console.error(error.message);
    }
    return false;
}

async function getChats() {
    try {
        var res = await fetch("/api/getchats", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        });
        const json = await res.json();
        return json;
    } catch (error) {
        newError("Fetching Chats Error: " + error.message);
        console.error(error.message);
    }
}

function newChatDate(text, id) {
    if (document.getElementById("chatdate" + id)) {
        return;
    }
    const dateDiv = document.createElement("div");
    dateDiv.className = "date";
    dateDiv.innerText = text;
    dateDiv.id = "chatdate" + id;
    sidebar.appendChild(dateDiv);
    const chatsDiv = document.createElement("div");
    chatsDiv.id = "chats" + id;
    sidebar.appendChild(chatsDiv);
}

async function startUpdate() {
    updatestart.style.display = "none";
    updateloadingdiv.style.display = "";
    try {
        const response = await fetch("./api/update");
        const json = await response.json();
        if (json == true) {
            updateloadingdiv.style.display = "none";
            updatecomplete.style.display = "";
        }
    } catch (error) {
        updatebg.style.display = "none";
        newError("Update Error: " + error.message);
        console.error(error.message);
    }
}

async function checkUpdate() {
    try {
        const response = await fetch("./api/updatecheck");
        const json = await response.json();
        if (json == true) {
            updatebg.style.display = "";
        }
    } catch (error) {
        newError("Update Check Error: " + error.message);
        console.error(error.message);
    }
}

async function getSettings() {
    try {
        var res = await fetch("/api/getsettings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        });
        const json = await res.json();
        return json;
    } catch (error) {
        newError("Fetching Settings Error: " + error.message);
        console.error(error.message);
    }
}

async function changeSettings(newSettings) {
    try {
        var res = await fetch("/api/changesettings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(newSettings),
        });
        const json = await res.json();
        return json;
    } catch (error) {
        newError("Change Settings Error: " + error.message);
        console.error(error.message);
    }
}

function loadChatFromURL() {
    const chatId = new URL(window.location.href).searchParams.get("chat");
    if (chatId && chats[chatId]) {
        selectChat(chatId);
    }
}

function createPreviewDiv(theme) {
    var previewdiv = document.createElement("div");
    previewdiv.className = "sttngsthemepreview";
    previewdiv.style.backgroundColor = theme[0];
    previewdiv.style.color = theme[4];
    // Create sidebar
    var sidebar = document.createElement("div");
    sidebar.style.cssText = `min-width: 59px; background-color: ${theme[1]}; text-align: center;`;
    var h2 = document.createElement("h2");
    h2.style.margin = "3px";
    h2.textContent = "AwsmChat";
    var chatList = document.createElement("div");
    chatList.style.cssText = "font-size: 5px; line-height: 8px;";
    for (var i = 0; i < 9; i++) {
        var chatDiv = document.createElement("div");
        chatDiv.style.cssText =
            "margin: 5px;text-align: left;padding-left: 2px;";
        chatDiv.textContent = "Untitled Chat";
        if (i == 0) {
            chatDiv.style.cssText += `background-color: ${theme[2]};border-radius: 2px;`;
        }
        chatList.appendChild(chatDiv);
    }
    sidebar.appendChild(h2);
    sidebar.appendChild(chatList);
    previewdiv.appendChild(sidebar);
    // Create main content
    var mainContent = document.createElement("div");
    mainContent.style.cssText =
        "height: 100%; width: 100%; display: flex; align-items: center; flex-direction: column;";
    // Message container
    var messageContainer = document.createElement("div");
    messageContainer.style.cssText =
        "height: 110px; max-width: 200px; display: flex; flex-direction: column; overflow: scroll;";
    var exampleError = document.createElement("div");
    exampleError.style.cssText = `width: 60px;height: 10px;background-color: ${theme[6]};margin-top: 3px;border-radius: 2px;color: ${theme[0]};text-align: center;line-height: 10px;`;
    exampleError.textContent = "Example Error x";
    var message1 = document.createElement("div");
    message1.style.cssText = `padding: 3px; background-color: ${theme[5]}; margin: 3px; margin-left: 30%; border-radius: 4px;`;
    message1.textContent =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
    var message2 = document.createElement("div");
    message2.style.cssText = `padding: 3px; background-color: ${theme[1]}; margin: 3px; margin-right: 30%; border-radius: 4px;`;
    message2.textContent =
        "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";
    mainContent.appendChild(exampleError);
    messageContainer.appendChild(message1);
    messageContainer.appendChild(message2);
    mainContent.appendChild(messageContainer);
    // Input container
    var inputContainer = document.createElement("div");
    inputContainer.style.cssText = `max-width: 200px; height: 10px; margin: 4px; border: 1px solid ${theme[3]}; border-radius: 2px; padding: 1px; display: flex; width: calc(100% - 9px);`;
    var inputText = document.createElement("div");
    inputText.style.cssText = "padding-left: 3px;";
    inputText.textContent = " + Type here...";
    inputContainer.appendChild(inputText);
    mainContent.appendChild(inputContainer);
    previewdiv.appendChild(mainContent);
    return previewdiv;
}
// Create preview for theme editor
var themeBuildVars = [];
for (let i = 1; i < 8; i++) {
    themeBuildVars.push(`var(--bc${i})`);
}
themebuilderprev.appendChild(createPreviewDiv(themeBuildVars));
themeBuildVars = [];
for (let i = 1; i < 8; i++) {
    themeBuildVars.push("#000");
    document.getElementById("tbc" + i).getElementsByTagName("input")[0].value =
        "";
}
themebuildername.value = "";

function themeBuildSelect() {
    themeBuildVars = settings.themes[themebuilderselect.value].slice();
    changeBuilderTheme(settings.themes[themebuilderselect.value]);
    themebuildername.value = themebuilderselect.value;
    for (let i = 0; i < 7; i++) {
        var tbcdiv = document.getElementById("tbc" + (i + 1));
        tbcdiv.getElementsByTagName("input")[0].value = themeBuildVars[i];
        tbcdiv.getElementsByTagName("div")[0].style.backgroundColor =
            themeBuildVars[i];
    }
    themeBuildEdit();
}

function themeBuildEdit(self) {
    if (self) {
        var i = parseInt(self.parentNode.id.slice(3));
        themeBuildVars[i - 1] = self.value;
        changeBuilderTheme(themeBuildVars);
        self.parentNode.getElementsByTagName("div")[0].style.backgroundColor =
            self.value;
        colorPickSelect(i);
    }
    // Check if themes has changed
    var offLimitThemes = ["", "light", "dark"];
    if (offLimitThemes.indexOf(themebuildername.value) == -1) {
        if (
            Object.keys(settings.themes).indexOf(themebuildername.value) != -1
        ) {
            var changed = false;
            for (let i = 0; i < 7; i++) {
                var cVal = document
                    .getElementById("tbc" + (i + 1))
                    .getElementsByTagName("input")[0].value;
                if (
                    cVal != "" &&
                    settings.themes[themebuildername.value][i] != cVal
                ) {
                    changed = true;
                    break;
                }
            }
            if (!changed) {
                savethemebttn.style = "";
                return;
            }
        }
        savethemebttn.style.backgroundColor = "var(--c7)";
        savethemebttn.style.opacity = "1";
        savethemebttn.style.cursor = "pointer";
    } else {
        savethemebttn.style = "";
    }
}

async function updateTheme() {
    if (savethemebttn.style.length == 0) {
        return;
    }
    var offLimitThemes = ["", "light", "dark"];
    if (!offLimitThemes.indexOf(themebuildername.value) == -1) {
        console.log("Offlimits");
        return;
    }
    settings.themes[themebuildername.value] = themeBuildVars;
    var res = await changeSettings(settings);
    if (res) {
        savethemebttn.style = "";
        updateSettingsMenu();
        autoTheme();
    } else {
        //settings = await getSettings();
        newError("Failed to Update Theme");
    }
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(c) {
    return (
        "#" + componentToHex(c[0]) + componentToHex(c[1]) + componentToHex(c[2])
    );
}

function hexToRgb(hex) {
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
        return r + r + g + g + b + b;
    });
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [
              parseInt(result[1], 16),
              parseInt(result[2], 16),
              parseInt(result[3], 16),
          ]
        : null;
}

function colorPickSelect(i) {
    var hexColor = themeBuildVars[i - 1];
    tbcolorpickname.innerText = "Color " + i;
    tbcolorpickdisp.getElementsByTagName("div")[0].style.backgroundColor =
        hexColor;
    colorPickDisplayCanvas(hexToRgb(hexColor));
    if (tbcolorpicker.style.display == "none") {
        tbcolorpicker.style.display = "";
    }
}

function hueToPos(c) {
    var r = c[0] / 255;
    var g = c[1] / 255;
    var b = c[2] / 255;
    // Segment 0: Red is max, Blue is min -> Green is rising
    if (r >= g && r >= b && b <= g && b <= 0.1) {
        return (0 + g) / 6;
    }
    // Segment 1: Green is max, Blue is min -> Red is falling
    if (g >= r && g >= b && b <= r && b <= 0.1) {
        return (1 + (1 - r)) / 6;
    }
    // Segment 2: Green is max, Red is min -> Blue is rising
    if (g >= b && g >= r && r <= b && r <= 0.1) {
        return (2 + b) / 6;
    }
    // Segment 3: Blue is max, Red is min -> Green is falling
    if (b >= g && b >= r && r <= g && r <= 0.1) {
        return (3 + (1 - g)) / 6;
    }
    // Segment 4: Blue is max, Green is min -> Red is rising
    if (b >= r && b >= g && g <= r && g <= 0.1) {
        return (4 + r) / 6;
    }
    // Segment 5: Red is max, Green is min -> Blue is falling
    if (r >= b && r >= g && g <= b && g <= 0.1) {
        var res = (5 + (1 - b)) / 6;
        return res >= 0.99 ? 1.0 : res; // Cleanly snap the very end back to 1.0
    }

    return 0;
}

function posToHue(t) {
    var x = 1 - Math.max(0, Math.min(1, 6 * t - 1, 5 - 6 * t));
    var y = Math.max(0, Math.min(1, 6 * t, 4 - 6 * t));
    var z = Math.max(0, Math.min(1, 6 * t - 2, 6 - 6 * t));
    return [Math.floor(x * 255), Math.floor(y * 255), Math.floor(z * 255)];
}

function findHue(rgb) {
    let r = rgb[0],
        g = rgb[1],
        b = rgb[2];
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);

    // 1. Handle grayscale (no hue)
    if (max == min) return [255, 0, 0];

    // 2. Normalize: Remove the "whiteness" (min) and scale to 255
    let chroma = max - min;
    let hueRGB = [
        ((r - min) / chroma) * 255,
        ((g - min) / chroma) * 255,
        ((b - min) / chroma) * 255,
    ];

    return hueRGB.map(Math.round);
}

function colorPickDisplayCanvas(rgb) {
    if (tbcolorpicker.style.display == "none") {
        tbcolorpicker.style.display = "";
    }
    var canvas = tbcolorpickdisp.getElementsByTagName("canvas")[0];
    var ctx = canvas.getContext("2d");
    var width = canvas.offsetWidth;
    var height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;
    var imageData = ctx.createImageData(width, height);
    var c = findHue(rgb);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            var i = (y * width + x) * 4;
            imageData.data[i] =
                (1 - y / height) * (255 - ((255 - c[0]) * x) / width); // Red
            imageData.data[i + 1] =
                (1 - y / height) * (255 - ((255 - c[1]) * x) / width); // Green
            imageData.data[i + 2] =
                (1 - y / height) * (255 - ((255 - c[2]) * x) / width); // Blue
            imageData.data[i + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);

    var b = 0;
    if (rgb[1] >= rgb[0] && rgb[1] >= rgb[2]) {
        b = 1;
    } else if (rgb[2] >= rgb[0] && rgb[2] >= rgb[1]) {
        b = 2;
    }
    var yPos = height - (rgb[b] / 255) * height;
    var b2 = 0;
    if (c[1] == 0) {
        b2 = 1;
    } else if (c[2] == 0) {
        b2 = 2;
    }
    var xPos = width - (rgb[b2] / rgb[b]) * width;
    if (rgb[b] == 0) {
        xPos = 0;
    }

    ctx.beginPath();
    ctx.arc(xPos, yPos, 4, 0, 2 * Math.PI);
    ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "white";
    ctx.stroke();

    tbcolorpickslider.children[0].style.left = hueToPos(c) * 287 - 10 + "px";
}

function selectColor(event) {
    const rect = tbcolorpickdisp
        .getElementsByTagName("canvas")[0]
        .getBoundingClientRect();
    var x = (event.clientX - rect.left) / rect.width;
    var y = (rect.height - (event.clientY - rect.top)) / rect.height;

    if (x < 0) {
        x = 0;
    } else if (x > 1) {
        x = 1;
    }
    if (y < 0) {
        y = 0;
    } else if (y > 1) {
        y = 1;
    }

    var hexColor =
        themeBuildVars[parseInt(tbcolorpickname.innerText.split(" ")[1]) - 1];
    var c = findHue(hexToRgb(hexColor));
    c = [
        Math.round((255 + (c[0] - 255) * x) * y),
        Math.round((255 + (c[1] - 255) * x) * y),
        Math.round((255 + (c[2] - 255) * x) * y),
    ];
    //Make func for this "updateColor(color)"?
    var inp = document
        .getElementById("tbc" + tbcolorpickname.innerText.split(" ")[1])
        .getElementsByTagName("input")[0];
    inp.value = rgbToHex(c);
    themeBuildEdit(inp);
}

function moveColorSlider(event) {
    const rect = tbcolorpickslider.getBoundingClientRect();
    const xPos = event.clientX - rect.left;
    var pos = xPos - 10;
    if (pos < -10) {
        pos = -10;
    } else if (pos > 277) {
        pos = 277;
    }
    var t = (pos + 10) / 287;
    var inp = document
        .getElementById("tbc" + tbcolorpickname.innerText.split(" ")[1])
        .getElementsByTagName("input")[0];
    var c = hexToRgb(inp.value);
    var h = posToHue(t);
    var max = Math.max(c[0], c[1], c[2]);
    var min = Math.min(c[0], c[1], c[2]);
    var range = max - min;
    // new = min + (hue % * rang)
    inp.value = rgbToHex([
        Math.round(min + (h[0] / 255) * range),
        Math.round(min + (h[1] / 255) * range),
        Math.round(min + (h[2] / 255) * range),
    ]);
    themeBuildEdit(inp);
    tbcolorpickslider.children[0].style.left = pos + "px";
}

var colorPickerClicked = false;
var colorSliderClicked = false;

settingsbg.addEventListener("mousemove", function (event) {
    if (colorPickerClicked) {
        selectColor(event);
    }
    if (colorSliderClicked) {
        moveColorSlider(event);
    }
});

settingsbg.addEventListener("mouseup", function (event) {
    colorPickerClicked = false;
    colorSliderClicked = false;
});

function settingsChange(self) {
    var value = self.value;
    if (self.tagName != "INPUT" && self.tagName != "SELECT") {
        value = self.attributes.value.value;
    }
    if (self.type == "number") {
        self.value = parseInt(self.value);
        if (self.value < 0 || !self.value) {
            self.value = 0;
        } else if (self.value > 65535) {
            self.value = 65535;
        }
    }
    var cSetting;
    if (self.id == "lightmodeselect") {
        cSetting = currentThemes[0];
    } else if (self.id == "darkmodeselect") {
        cSetting = currentThemes[1];
    } else {
        cSetting = JSON.stringify(settings[self.id.split("_")[1]]);
    }
    //console.log(value, cSetting);
    if (value != cSetting) {
        savesettingsbttn.style.cursor = "";
        savesettingsbttn.style.backgroundColor = "var(--c7)";
        savesettingsbttn.style.opacity = "1";
    } else {
        var notChanged = true;
        // Loop through all settings to check if they are the same
        var keys = Object.keys(settings);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] != "themes" && keys[i] != self.id.split("_")[1]) {
                var cSttng = document.getElementById("sttngs_" + keys[i]);
                var cVal = cSttng.value;
                if (cSttng.tagName != "INPUT" && cSttng.tagName != "SELECT") {
                    cVal = cSttng.attributes.value.value;
                }
                if (JSON.stringify(settings[keys[i]]) != cVal) {
                    notChanged = false;
                }
            }
        }
        if (notChanged) {
            savesettingsbttn.style.cursor = "not-allowed";
            savesettingsbttn.style.backgroundColor = "";
            savesettingsbttn.style.opacity = "";
        }
    }
}

async function updateSettings() {
    if (savesettingsbttn.style.backgroundColor == "") {
        return;
    }
    var keys = Object.keys(settings);
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] != "themes") {
            var cSttng = document.getElementById("sttngs_" + keys[i]);
            var cVal = cSttng.value;
            if (cSttng.tagName != "INPUT" && cSttng.tagName != "SELECT") {
                cVal = cSttng.attributes.value.value;
            }
            if (JSON.stringify(settings[keys[i]]) != cVal) {
                settings[keys[i]] = JSON.parse(cVal);
            }
        }
    }
    if (
        lightmodeselect.value != currentThemes[0] ||
        darkmodeselect.value != currentThemes[1]
    ) {
        currentThemes = [lightmodeselect.value, darkmodeselect.value];
        autoTheme();
        updateCookie(activeModel, currentThemes);
    }
    var res = await changeSettings(settings);
    if (res) {
        savesettingsbttn.style.backgroundColor = "";
    } else {
        //settings = await getSettings();
        newError("Failed to Update Settings");
    }
}

function updateSettingsMenu() {
    var keys = Object.keys(settings);
    for (let i = 0; i < keys.length; i++) {
        sttng = settings[keys[i]];
        if (sttng == true) {
            toggleSwitch(document.getElementById("sttngs_" + keys[i]), "on");
        } else if (typeof sttng != "object") {
            document.getElementById("sttngs_" + keys[i]).value = sttng;
        }
    }
    sttngs_themes.innerHTML = "";
    lightmodeselect.innerHTML = "";
    darkmodeselect.innerHTML = "";
    themebuilderselect.innerHTML = "";
    var themeKeys = Object.keys(settings.themes);
    for (let i = 0; i < themeKeys.length; i++) {
        var ctheme = settings.themes[themeKeys[i]];
        // Create theme preview
        var tdiv = document.createElement("div");
        tdiv.id = i + "_themeprev";
        tdiv.appendChild(createPreviewDiv(ctheme));
        var titlediv = document.createElement("div");
        titlediv.className = "sttngsthemetitle";
        titlediv.innerText = themeKeys[i];
        tdiv.appendChild(titlediv);
        sttngs_themes.appendChild(tdiv);
        // Create options for theme dropdowns
        var themeOption = document.createElement("option");
        themeOption.innerText = themeKeys[i];
        themeOption.value = themeKeys[i];
        lightmodeselect.appendChild(themeOption);
        themeOption = document.createElement("option");
        themeOption.innerText = themeKeys[i];
        themeOption.value = themeKeys[i];
        darkmodeselect.appendChild(themeOption);
        themeOption = document.createElement("option");
        themeOption.innerText = themeKeys[i];
        themeOption.value = themeKeys[i];
        themebuilderselect.appendChild(themeOption);
    }
    themebuilderselect.value = "";
    lightmodeselect.value = currentThemes[0];
    darkmodeselect.value = currentThemes[1];
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.getElementById("1_themeprev").style.border =
            "solid 2px var(--c7)";
    } else {
        document.getElementById("0_themeprev").style.border =
            "solid 2px var(--c7)";
    }
}

async function start() {
    settings = await getSettings();
    var cookie = getCookie();
    if (cookie && cookie.currentThemes) {
        cookie.currentThemes = JSON.parse(atob(cookie.currentThemes));
        for (let i = 0; i < 2; i++) {
            if (
                Object.keys(settings.themes).indexOf(cookie.currentThemes[i]) !=
                -1
            ) {
                currentThemes[i] = cookie.currentThemes[i];
            }
        }
    }
    autoTheme();
    if (
        (window.location.hostname == "127.0.0.1" ||
            window.location.hostname == "localhost") &&
        !settings.https
    ) {
        ollamaURL = `http://${window.location.hostname}:${settings.ollamaPort}`;
    }
    const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];
    const now = new Date();
    chats = await getChats();
    const chatIds = Object.keys(chats).sort().reverse();
    for (let i = 0; i < chatIds.length; i++) {
        var chatDate = new Date(parseInt(chatIds[i]));
        if (
            chatDate.getFullYear() == now.getFullYear() &&
            chatDate.getMonth() == now.getMonth() &&
            chatDate.getDate() == now.getDate()
        ) {
            // Today
            addChat(chatIds[i], false, "chatstoday");
            if (chatdatetoday.style.display == "none") {
                chatdatetoday.style.display = "";
            }
        } else if (
            chatDate.getFullYear() == now.getFullYear() &&
            now.getTime() - chatDate.getTime() <= 86400000
        ) {
            // Yesterday
            newChatDate("Yesterday:", "yesterday");
            addChat(chatIds[i], false, "chatsyesterday");
        } else if (
            chatDate.getFullYear() == now.getFullYear() &&
            now.getTime() - chatDate.getTime() <= 604800000
        ) {
            // Last 7 days
            newChatDate("Last 7 Days:", "last7days");
            addChat(chatIds[i], false, "chatslast7days");
        } else if (
            chatDate.getFullYear() == now.getFullYear() &&
            chatDate.getMonth() == now.getMonth()
        ) {
            // This month
            newChatDate("This Month:", "thismonth");
            addChat(chatIds[i], false, "chatsthismonth");
        } else if (chatDate.getFullYear() == now.getFullYear()) {
            // This year
            newChatDate(
                months[chatDate.getMonth()] + ":",
                months[chatDate.getMonth()].toLowerCase(),
            );
            addChat(
                chatIds[i],
                false,
                "chats" + months[chatDate.getMonth()].toLowerCase(),
            );
        } else {
            // More than a year ago
            newChatDate(
                `${months[chatDate.getMonth()]} ${chatDate.getFullYear()}:`,
                months[chatDate.getMonth()].toLowerCase() +
                    chatDate.getFullYear(),
            );
            addChat(
                chatIds[i],
                false,
                "chats" +
                    months[chatDate.getMonth()].toLowerCase() +
                    chatDate.getFullYear(),
            );
        }
    }
    models = await getModels();
    for (let i = 0; i < Object.keys(models).length; i++) {
        var mcdiv = document.createElement("div");
        mcdiv.innerText = Object.keys(models)[i];
        modelchangelist.appendChild(mcdiv);
        var mdiv = document.createElement("div");
        mdiv.setAttribute(
            "onclick",
            `selectModel("${Object.keys(models)[i]}");toggleList();`,
        );
        mdiv.className = "modelselectlistitem";
        var mndiv = document.createElement("div");
        mndiv.style.display = "flex";
        var mn1div = document.createElement("div");
        mn1div.style.paddingRight = "5px";
        mn1div.innerText = Object.keys(models)[i];
        mndiv.appendChild(mn1div);
        var spacediv = document.createElement("div");
        spacediv.style.width = "100%";
        mndiv.appendChild(spacediv);
        var mn2div = document.createElement("div");
        mn2div.className = "modelselectlistinfo";
        mn2div.innerText = models[Object.keys(models)[i]].parameterSize;
        mndiv.appendChild(mn2div);
        var mn3div = document.createElement("div");
        mn3div.className = "modelselectlistinfo";
        mn3div.innerText = formatBites(models[Object.keys(models)[i]].size);
        mndiv.appendChild(mn3div);
        mdiv.appendChild(mndiv);
        const capabilities = await getModelData(Object.keys(models)[i]);
        models[Object.keys(models)[i]]["capabilities"] = [];
        if (capabilities.length > 1) {
            var capdiv = document.createElement("div");
            capdiv.style.display = "flex";
            for (let j = 1; j < capabilities.length; j++) {
                models[Object.keys(models)[i]]["capabilities"].push(
                    capabilities[j],
                );
                var capinfodiv = document.createElement("div");
                capinfodiv.className = "modelselectlistcapa";
                capinfodiv.innerText = capabilities[j];
                capdiv.appendChild(capinfodiv);
            }
            mdiv.appendChild(capdiv);
        }
        if (i + 1 == models.length) {
            mdiv.style.borderBottom = "none";
        }
        modelselectlist.appendChild(mdiv);
    }
    if (cookie && Object.keys(models).indexOf(cookie.lastModel) != -1) {
        selectModel(cookie.lastModel);
    } else {
        selectModel(Object.keys(models)[0]);
    }
    var last = [Number.MAX_SAFE_INTEGER, ""];
    for (let i = 0; i < Object.keys(models).length; i++) {
        if (models[Object.keys(models)[i]].size < last[0]) {
            last[0] = models[Object.keys(models)[i]].size;
            last[1] = Object.keys(models)[i];
        }
    }
    titleModel = last[1];
    loadChatFromURL();
    updateSettingsMenu();
    function change() {
        fileselectscreen.style.display = "";
    }
    function changeBack() {
        fileselectscreen.style.display = "none";
    }
    mainchat.addEventListener("dragover", change, false);
    mainchat.addEventListener("dragleave", changeBack, false);
    mainchat.addEventListener("drop", changeBack, false);
    fileselect.addEventListener("change", uploadFiles);
    textbox.focus();
    if (settings.checkUpdates) {
        await checkUpdate();
    }
}
start();
