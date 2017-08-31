let request = require('request');
request.defaults({jar:true});

let Alexa = require('alexa-sdk');

const user = process.env['username']; //populated in AWS Lambda
const pass = process.env['password']; //populated in AWS Lambda

const DoorState = {
    Open:'1',
    Closed:'0'
};
const Door = {
    Left:"leftDoorId",
    Right:"rightDoorId"
};

/**
 * Authenticates with liftmaster site and uses sessionID to authorize future calls
 * @param {*} callback callback to be called on completion
 */
function authenticate(callback) {
    var options = {
        method: 'POST',
        url: 'https://www.myliftmaster.com/',
        headers: 
        { 
            'accept-language': 'en-US,en;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            referer: 'https://www.myliftmaster.com/',
            dnt: '1',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'content-type': 'application/x-www-form-urlencoded',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3192.0 Safari/537.36',
            'upgrade-insecure-requests': '1',
            origin: 'https://www.myliftmaster.com'
        },
        form: {
            Email: user,
            Password: pass
        } 
    };
    request(options, function (error, response, body) {
        if (error) throw new Error(error);
        var cookies = response.headers['set-cookie'];
        for(var i = 0; i < cookies.length; i++) {
            cookies[i] = cookies[i].substring(0,cookies[i].indexOf(";")+1);
        }
        var cookieString = cookies.join('');
        callback && callback(cookieString);
    });
}

/**
 * API to get information about the state of all Liftmaster devices
 * @param {*} cookie cookie returned from authentication which includes a sessionID
 * @param {*} callback callback to be called after the JSON response is returned
 */
function getDevices(cookie, callback) {
    var options = { 
        method: 'GET',
        url: 'https://www.myliftmaster.com/api/MyQDevices/GetAllDevices',
        qs: { brandName: 'Liftmaster' },
        headers: 
        { 
            cookie: cookie,
            'accept-language': 'en-US,en;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            referer: 'https://www.myliftmaster.com/Dashboard',
            dnt: '1',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3192.0 Safari/537.36',
            'x-ts-ajax-request': 'true',
            'x-requested-with': 'XMLHttpRequest',
            accept: 'application/json, text/javascript, */*; q=0.01' 
        }
    };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);
        var json = JSON.parse(body);
        console.log(json);
        var cookies = response.headers['set-cookie'];
        for(var i = 0; i < cookies.length; i++) {
            cookies[i] = cookies[i].substring(0,cookies[i].indexOf(";")+1);
        }
        var c = cookies.join('');
        cookie+=c;

        callback & callback(cookie,json);
    });
}

/**
 * Opens/Closes door based on it's current state
 * @param {*} door the door to change
 * @param {*} state the state to change it to, e.g. Opened/Closed
 * @param {*} json the json response detailing device info on the account
 * @param {*} cookie cookie returned from getAllDevices + authentication
 */
function toggleDoor(door, state, json, cookie) {
    var number = parseInt(process.env[door]);
    console.log(number)
    var device = json.filter((val) => {
        return val["MyQDeviceId"] === number;
    })[0];
    var currentState = device["StateName"];
    if(state === '1' && currentState !== 'Closed'){
        return "The "+ (Door.Left === door ? "left":"right") +" door is already open or is currently opening";
    }
    if(state === '0' && currentState !== 'Opened') {
        return "The "+ (Door.Left === door ? "left":"right") +" door is already closed or is currently closing";
    }  
    var options = { 
        method: 'POST',
        url: 'https://www.myliftmaster.com/Device/TriggerStateChange',
        qs: 
        { SerialNumber: number,
            attributename: 'desireddoorstate',
            attributevalue: state },
        headers: 
        {
            cookie:cookie,
            'accept-language': 'en-US,en;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            referer: 'https://www.myliftmaster.com/Dashboard',
            dnt: '1',
            'content-type': 'json',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3192.0 Safari/537.36',
            'x-ts-ajax-request': 'true',
            'x-requested-with': 'XMLHttpRequest',
            origin: 'https://www.myliftmaster.com',
            accept: 'application/json, text/javascript, */*; q=0.01' 
        }
    };
    request(options, function (error, response, body) {
    if (error) throw new Error(error);
    });
}

function logout(cookie, json) {
    var options = { 
        method: 'GET',
        url: 'https://www.myliftmaster.com/Account/Logout',
        headers: 
        { 
            cookie: cookie,
            'accept-language': 'en-US,en;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            referer: 'https://www.myliftmaster.com/Dashboard',
            dnt: '1',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3192.0 Safari/537.36',
            'upgrade-insecure-requests': '1'
        }
    };

    request(options, function (error, response, body) {
    if (error) throw new Error(error);
    });

}

/**
 * Lambda Handler
 */
exports.handler = (event, context, callback) => {
    // TODO implement
    var alexa = Alexa.handler(event, context, callback);

    var handler = {
        'OpenLeft':function() {
            authenticate((cookie) => {
                getDevices(cookie, (cookie, json) => {
                    this.emit(":tell", toggleDoor(Door.Left, DoorState.Open, json, cookie) || "Opening Left Garage Door");
                });
            });
        },
        'OpenRight':function() {
            authenticate((cookie) => {
                getDevices(cookie, (cookie, json) => {
                    this.emit(":tell", toggleDoor(Door.Right, DoorState.Open, json, cookie) || "Opening Right Garage Door");
                });
            });
        },
        'CloseLeft':function() {
            authenticate((cookie) => {
                getDevices(cookie, (cookie, json) => {
                    this.emit(":tell", toggleDoor(Door.Left, DoorState.Closed, json, cookie) || "Closing Left Garage Door");
                });
            });
        },
        'CloseRight':function() {
            authenticate((cookie) => {
                getDevices(cookie, (cookie, json) => {
                    this.emit(":tell", toggleDoor(Door.Right, DoorState.Closed, json, cookie) || "Closing Right Garage Door");
                });
            });
        }
    };
    alexa.registerHandlers(handler);
    alexa.execute();
};