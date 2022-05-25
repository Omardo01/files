const express = require("express");
const bodyParser = require("body-parser");
const fs = require('fs');
const axios = require('axios');
const shelljs = require('shelljs');
const shellExec = require('shell-exec');
var Gpio = require('onoff').Gpio;
var pushButton = new Gpio(17, 'in', 'rising', {debounceTimeout: 10});


const PiCamera = require('pi-camera');
const myCamera = new PiCamera({
  mode: 'photo',
  output: '/home/pi/wpp/test.jpg',
  width: 640,
  height: 480,
  nopreview: true,
});
const config = require('./config.json');
const { Client, MessageMedia } = require('whatsapp-web.js');
const SESSION_FILE_PATH = './session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}
process.title = "whatsapp-node-api";
global.client = new Client({ puppeteer: {headless: true, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']}, session: sessionCfg});
global.authed = false;
const app = express();

const port = process.env.PORT || config.port;
//Set Request Size Limit 50 MB
app.use(bodyParser.json({limit: '50mb'}));

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

client.on('qr', qr => {
    fs.writeFileSync('./components/last.qr',qr);
});


client.on('authenticated', (session) => {
    console.log("AUTH!");
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function(err) {
        if (err) {
            console.error(err);
        }
        authed=true;
    });
    try{
        fs.unlinkSync('./components/last.qr')
    }catch(err){}
});

client.on('auth_failure', () => {
    console.log("AUTH Failed !")
    sessionCfg = ""
    process.exit()
});

var lastmessage = 0;
//TU NUMERO DE TELEFONO VA ACA
var SEND_TO = "";

client.on('ready', () => {
    console.log('Client is ready!');
	client.sendMessage(SEND_TO + "@c.us", "Servicio iniciado");
	pushButton.watch(function (err, value) {
		if(Date.now() > lastmessage || lastmessage == 0) {
			lastmessage = Date.now() + (1000*20);
			date = (new Date()).getHours() + ":" + (new Date()).getMinutes();
			client.sendMessage(SEND_TO + "@c.us", unescape("%uD83D%uDD14") + " TIMBRE - "+date+"hs");
			myCamera.snap().then((result) => {
				media = MessageMedia.fromFilePath('/home/pi/wpp/test.jpg');
				client.sendMessage(SEND_TO + "@c.us", media);
			}).catch((error) => {
				console.log("error", error);
			});
		}
	});
});

client.on('message', async msg => {
	if (msg.body === '!ping') {
        // Send a new message to the same chat
        client.sendMessage(msg.from, 'pong');
    } else if (msg.body === unescape("%uD83D%uDD14")) {
		let chat = await msg.getChat();
		chat.sendStateTyping();
		myCamera.snap().then((result) => {
			media = MessageMedia.fromFilePath('/home/pi/wpp/test.jpg');
			client.sendMessage(msg.from, media);
			setTimeout(() => {
				chat.clearState();
			}, 5000);
		}).catch((error) => {
			console.log("error", error);
		});
    } else if (msg.hasMedia) {
        const attachmentData = await msg.downloadMedia();
		fs.writeFile('/home/pi/wpp/voice.ogg', attachmentData.data, 'base64', function (err) {
			if (err != null) {
				console.log(err);
				return;
			} else {
				shellExec('omxplayer -o local --vol 500 /home/pi/wpp/voice.ogg');
			}
		});
		client.sendMessage(msg.from, unescape("%uD83D%uDD0A") + unescape("%uD83D%uDD0A") + unescape("%uD83D%uDD0A"));
		
    }
})
client.initialize();

const chatRoute = require('./components/chatting');
const groupRoute = require('./components/group');
const authRoute = require('./components/auth');
const contactRoute = require('./components/contact');

app.use(function(req,res,next){
    console.log(req.method + ' : ' + req.path);
    next();
});
app.use('/chat',chatRoute);
app.use('/group',groupRoute);
app.use('/auth',authRoute);
app.use('/contact',contactRoute);

app.listen(port, () => {
    console.log("Server Running Live on Port : " + port);
});