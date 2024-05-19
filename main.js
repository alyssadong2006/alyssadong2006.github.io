// after clicking cross button
var cross;
var coll;
var con;
var i;


window.onload = function(){
    cross = document.getElementById("cross");
    cross.addEventListener('click', showText);
    coll = document.getElementsByClassName('collapsible');
    con = document.getElementsByClassName('content');
    var i;

    //collapsible on home screen
    for (i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
          this.classList.toggle("active");
          var content = this.nextElementSibling;
          /*if (content.style.display === "block") {
            content.style.display = "none";
          } else {
            content.style.display = "block";
          }*/
          if (content.style.maxHeight){
            content.style.maxHeight = null;
          } else {
            content.style.maxHeight = content.scrollHeight + "px";
          } 
          if (this.style.borderRadius == "25px" || this.style.borderRadius == ""){
            content.style.border = "5px solid rgb(0, 138, 207)"
            this.style.borderRadius = "25px 25px 0px 0px";
          } else if (this.style.borderRadius == "25px 25px 0px 0px"){
            content.style.border = "5px solid rgb(0, 138, 207)"
            setTimeout(() => {
                this.style.borderRadius = "25px";
                content.style.border = "0px solid rgb(0, 138, 207)"
            }, 500);
          }
        });
    }
}

function playMusic() {
  var audio = document.getElementById("bgmusic");
  var bttn = document.getElementById("play-music")
  if (bttn.innerHTML == "<b>Play Sound</b>"){
    bttn.innerHTML = "<b>Stop Sound</b>";
    audio.play();
  } else {
    bttn.innerHTML = "<b>Play Sound</b>";
    audio.pause();
  }
  
}

//hidden text
function showText() {
    var text = document.getElementById("hidden-text");
    result = text.style.display
    if(result == "none"){
        text.style.display = "inline-block";
    }
    else
    {
        text.style.display = "none";
    }
}

//clicking randomly
addEventListener('click', createBox);
function createBox(event) {
    offset = window.scrollY
    var box = document.createElement('div');
    box.className = 'box';
    box.style.left = event.pageX - 150 + 'px';
    box.style.top = event.pageY - 50 - offset + 'px';
    box.innerHTML = "<b>ERROR 404</b>"
    document.body.appendChild(box);

    var value = Math.floor(Math.random() * 4)

    if (value == 0){
    setTimeout(() => {
        box.style.color = "rgba(0, 255, 0, 0.15)";
    }, 300);
    } else if (value == 1){
    setTimeout(() => {
        box.style.color = "rgba(255, 255, 0, 0.15)";
    }, 300);
    } else if (value == 2){
    setTimeout(() => {
        box.style.color = "rgba(0, 255, 255, 0.15)";
    }, 300);
    } else if (value == 3){
    setTimeout(() => {
        box.style.color = "rgba(0, 0, 255, 0.15)";
    }, 300);
    }

    setTimeout(() => {
        box.style.border = "0px";
    }, 200);
}

document.addEventListener("mousemove", (e) => {
  let body = document.querySelector("body");
	let circle = document.createElement("span");
	let x = e.pageX;
	let y = e.pageY;
	document.querySelector("#cursor").style.left = x + "px";
	document.querySelector("#cursor").style.top = y + "px";
	circle.style.left = x + "px";
	circle.style.top = y + "px";
	let size = Math.random() * Math.floor(Math.random() * (5 - 1 + 1) + 1);
	circle.style.width = 10 + size + "px";
	circle.style.height = 10 + size + "px";
  circle.style.zIndex = 1;
  body.appendChild(circle);
	
	setTimeout(() => {
		circle.style.opacity = 0;
		setTimeout(() => {
			circle.remove();
		}, 100);
	}, 2500);
});