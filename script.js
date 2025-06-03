var models;
var titleModel;
var activeModel;
var chats = {};
var files = { text: {}, images: {} };
var activeChat = 0;
var temp = "";
var generating = false;
var openChat = true;

var themes = {
    light: ["#fff", "#eee", "#cdcdcd", "#b8b8b8", "#000", "#90cbff", "#f00"],
    dark: [
        "#000",
        "#1d1d1d",
        "#323232",
        "#474747",
        "#fff",
        "#0e7dde",
        "#ff3d3d",
    ],
};

function changeTheme(t) {
    theme.innerText = `:root {--c1: ${t[0]};--c2: ${t[1]};--c3: ${t[2]}7d;--c4: ${t[2]};--c5: ${t[3]};--c6: ${t[4]};--c7: ${t[5]};--c8: ${t[6]}`;
}

function autoTheme() {
    if (window.matchMedia("(prefers-color-scheme:dark)").matches) {
        changeTheme(themes["dark"]);
    } else {
        changeTheme(themes["light"]);
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

function format(text) {
    // Temporary, should make own parser?
    return marked.parse(text.replaceAll("</think>", "\n</think>"));
}

async function generate(model, id, current) {
    chats[current].messages.push({ role: "assistant", content: "" });
    chats[current].modelList.push(activeModel);
    document.getElementById("name" + current).className =
        "chatselecttext loading";
    try {
        const response = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages: chats[current].messages,
                //think: true,
                // for thinking models only!
            }),
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
                        chats[current].messages[
                            chats[current].messages.length - 1
                        ].content += JSON.parse(decoded[i]).message.content;
                    }

                    if (document.getElementById(id)) {
                        // innerHTML bad!! need to make parser that can dynamically add new elements + use innerText instead
                        // Mostly so that you can highlight items while chat is generating (currently not working D:)
                        document.getElementById(id).innerHTML = format(
                            chats[current].messages[
                                chats[current].messages.length - 1
                            ].content,
                        );
                        if (scrolledDown) {
                            chatarea.scrollTop =
                                chatarea.scrollHeight - chatarea.offsetHeight;
                        }
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
                    document.getElementById(id).innerHTML += format(message);
                }
            }
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
    try {
        await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Change this to a system prompt
            body: JSON.stringify({
                model: titleModel,
                prompt: `Condense the user's input to a maximum of 10 words.
If the input is already 10 words or less, output the original input verbatim.
Strictly adhere to these rules: do not provide answers, explanations, or any text beyond the condensed/original input.
Do not acknowledge the source of the input.
Do not mention the user in your output.
Begin immediately after this line:
${chats[id].messages[0].content.slice(0, 500)}`,
                stream: false,
            }),
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
        chatstoday.appendChild(cdiv);
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
        var ext = "";
        if (filename.includes(".")) {
            ext = filename.split(".")[filename.split(".").length - 1];
        }
        usercontent += `\n${filename}\n\`\`\`${ext}\n${files.text[filename]}\n\`\`\``;
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
        if (document.getElementById("imgs" + activeChat + "_" + i)) {
            document.getElementById("imgs" + activeChat + "_" + i).remove();
        }
        document.getElementById("user" + activeChat + "_" + i).remove();
        document.getElementById("ai" + activeChat + "_" + i).remove();
        document.getElementById("info" + activeChat + "_" + i).remove();
        document.getElementById("userinfo" + activeChat + "_" + i).remove();
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
    document.getElementById(type + num).remove();
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
        if (
            (!Object.keys(files.text).includes(file.name) ||
                !files.text[file.name]) &&
            (!Object.keys(files.images).includes(file.name) ||
                !files.images[file.name])
        ) {
            if (file.type.split("/")[0] == "image") {
                if (models[activeModel].capabilities.includes("vision")) {
                    reader.addEventListener(
                        "load",
                        () => {
                            createFile(file.name, URL.createObjectURL(file));
                            files.images[file.name] = reader.result;
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
                        createFile(file.name);
                        let utf8decoder = new TextDecoder();
                        files.text[file.name] = utf8decoder.decode(
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
        var modelrequest = await fetch("http://localhost:11434/api/tags")
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
        var request = await fetch("http://localhost:11434/api/show", {
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

function newChat() {
    if (activeChat != 0) {
        for (let i = 0; i < chats[activeChat].messages.length / 2; i++) {
            if (document.getElementById("imgs" + activeChat + "_" + i)) {
                document.getElementById("imgs" + activeChat + "_" + i).remove();
            }
            document.getElementById("user" + activeChat + "_" + i).remove();
            document.getElementById("ai" + activeChat + "_" + i).remove();
            document.getElementById("info" + activeChat + "_" + i).remove();
            document.getElementById("userinfo" + activeChat + "_" + i).remove();
        }
    }
    chatIndex = -1;
    newchatmsg.style.display = "";
    activeChat = 0;
    textbox.value = temp;
    resizeInput();
    textbox.focus();
    var allChats = document.getElementsByClassName("chatselect");
    for (let i = 1; i < allChats.length; i++) {
        allChats[i].style.backgroundColor = "";
        allChats[i].getElementsByClassName(
            "chatselectinfo",
        )[0].style.background = "";
    }
}

function newError(text) {
    const errDiv = document.createElement("div");
    errDiv.id = "error" + errorsdiv.children.length;
    const errName = document.createElement("div");
    errName.innerText = text;
    errDiv.appendChild(errName);
    const errClose = document.createElement("div");
    errClose.className = "errorclose";
    errClose.setAttribute("onclick", `${errDiv.id}.remove()`);
    const errCloseDiv = document.createElement("div");
    errCloseDiv.style.width = "12px";
    errCloseDiv.style.position = "absolute";
    errCloseDiv.style.transform = "rotate(-45deg)";
    errClose.appendChild(errCloseDiv);
    errClose.appendChild(document.createElement("div"));
    errDiv.appendChild(errClose);
    errorsdiv.appendChild(errDiv);
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

function selectChat(id) {
    if (activeChat == id) {
        return;
    }
    if (activeChat != 0) {
        for (let i = 0; i < chats[activeChat].messages.length / 2; i++) {
            if (document.getElementById("imgs" + activeChat + "_" + i)) {
                document.getElementById("imgs" + activeChat + "_" + i).remove();
            }
            document.getElementById("user" + activeChat + "_" + i).remove();
            document.getElementById("ai" + activeChat + "_" + i).remove();
            document.getElementById("info" + activeChat + "_" + i).remove();
            document.getElementById("userinfo" + activeChat + "_" + i).remove();
        }
    }
    activeChat = id;
    textbox.value = chats[activeChat].temp;
    resizeInput();
    textbox.focus();
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
                div.innerHTML = format(chat.content);
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
    if (modelselectlist.style.display == "") {
        toggleList();
    }
    var y = event.clientY + 10;
    if (y + 74 >= document.body.offsetHeight) {
        y = document.body.offsetHeight - 74;
    }
    chatinfodiv.style.left = event.clientX - 10 + "px";
    chatinfodiv.style.top = y + "px";
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
    if (activeChat == id) {
        newChat();
    }
    document.getElementById("chat" + id).remove();
    delete chats[id];
    await deleteChat(id);
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
    if (id == "settingsbg") {
        settingsbg.style.display = "none";
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

function selectModel(name) {
    activeModel = name;
    modelname.innerText = name;
    const d = new Date();
    d.setTime(d.getTime() + 31536000000); // 1 year
    document.cookie = "lastModel=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
    document.cookie =
        "lastModel=" + name + ";expires=" + d.toUTCString() + ";path=/";
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
        sidebar.style.zIndex != "1"
    ) {
        if (sidebar.style.display != "none") {
            toggleSideBar();
        }
        sidebar.style.position = "absolute";
        sidebar.style.zIndex = "1";
        sidebar.style.boxShadow = "0px 0px 15px var(--c4)";
    } else if (
        document.body.offsetWidth >= document.body.offsetHeight &&
        sidebar.style.zIndex == "1"
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

var cmdPressed = false;

document.addEventListener("keydown", function (event) {
    if (event.key == "Meta") {
        cmdPressed = true;
    } else if (event.key == "Enter") {
        if (cmdPressed) {
            send();
        } else {
            changeChatTitle();
        }
    }
});

document.addEventListener("keyup", function (event) {
    if (event.key == "Meta") {
        cmdPressed = false;
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
        await fetch("/api/deletechats", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(id),
        });
    } catch (error) {
        newError("Error Deleting Chat: " + error.message);
        console.error(error.message);
    }
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

async function start() {
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
            addChat(chatIds[i], false);
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
    var lastModel = document.cookie
        .slice(document.cookie.indexOf("lastModel="))
        .split("=")[1];
    if (document.cookie != "" && Object.keys(models).indexOf(lastModel) != -1) {
        selectModel(lastModel);
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
    await checkUpdate();
}
start();
