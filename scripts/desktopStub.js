import "./publicPath";
const script = document.createElement("script");
script.src = "http://localhost:8080/Server_renderer.js";
document.head.prepend(script);
