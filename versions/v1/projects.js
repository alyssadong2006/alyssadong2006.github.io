document.addEventListener("mousemove", (e) => {
	let body = document.querySelector("body");
	let circle = document.createElement("span");
	let x = e.pageX;
	let y = e.pageY;
	document.querySelector("#cursor").style.left = x + "px";
	document.querySelector("#cursor").style.top = y + "px";
	circle.style.left = x + "px";
	circle.style.top = y + "px";
	let size = Math.random() * Math.floor(Math.random() * (100 - 10 + 1) + 10);
	circle.style.width = 20 + size + "px";
	circle.style.height = 20 + size + "px";
    circle.style.zIndex = -1;
    body.appendChild(circle);
	
	setTimeout(() => {
		circle.style.opacity = 0;
		setTimeout(() => {
			circle.remove();
		}, 2500);
	}, 2500);
});

function playMusic() {
	var audio = document.getElementById("bgmusicTwo");
	var bttn = document.getElementById("play-musicTwo")
	if (bttn.innerHTML == "<b>Play Sound</b>"){
	  bttn.innerHTML = "<b>Stop Sound</b>";
	  audio.play();
	} else {
	  bttn.innerHTML = "<b>Play Sound</b>";
	  audio.pause();
	}
	
  }