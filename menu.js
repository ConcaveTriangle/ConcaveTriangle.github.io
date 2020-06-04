function menu() {
  var x = document.getElementById("navDemo");
  if (x.className.indexOf("show") == -1) {
    x.className += " show";
  }
  else {
    x.className = x.className.replace(" show", "");
  }
}

function enlarge(n) {
  var id = "enlarge" + n
  var x = document.getElementById(id);
  if (x.className == "enlarged") {
    x.className = "";
    x.style.width = "80%";
  }
  else {
    x.style.width = "600px";
    x.className = "enlarged";
  }
}
