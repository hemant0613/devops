javascript
const backendURL = "/api/messages";

async function loadMessages() {
    const response = await fetch(backendURL);
    const data = await response.json();

    const list = document.getElementById("messages");
    list.innerHTML = "";

    data.forEach(item => {
        const li = document.createElement("li");
        li.innerText = item.text;
        list.appendChild(li);
    });
}

async function sendMessage() {
    const message = document.getElementById("message").value;

    await fetch(backendURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: message })
    });

    document.getElementById("message").value = "";

    loadMessages();
}

loadMessages();