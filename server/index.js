var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var crypto = require('crypto');

var game_id = 0;
var GAME_CONSTANTS = {
    MIN_USERS: 2,
    MAX_USERS: 5,
    TIMEOUT: 2000, //msecs
};

var store = {
    users: {},
    games: {},
};

var SOCKET_EVENTS = {
    INBOUND: {
        LOGIN: 'login',
        LOGOUT: 'logout',    
        CREATE_GAME: 'create_game',
        LEAVE_GAME: 'leave_game',
        JOIN_GAME: 'join_game'
    }, 
    OUTBOUND: {
        NAME_ALREADY_EXISTS: 'name_already_exists',
        LOGIN_SUCCESS: 'login_success',
        BROADCAST_USERS: 'broadcast_user',
        INVALID_TOKEN: 'invalid_token',
        UPDATE_GAME: 'update_game',
        UPDATE_GAME_LIST: 'update_game_list',
        INVALID_GAME: 'invalid_game'
    }
}

var hash = {
    SALT: "#@!ze-game836",
    createHash: function(data) {
        var shasum = crypto.createHash('sha1').update(this.SALT);
        return shasum.update(data).digest('hex');
    }
}

server.listen(3000, function() {
    console.log("Server started");   
});

io.on('connection', function (socket) {
    socket.on(SOCKET_EVENTS.INBOUND.LOGIN, function(data) {
        var handle = data.handle.trim().toLowerCase();
        if(handle in store.users) {
            socket.emit(SOCKET_EVENTS.OUTBOUND.NAME_ALREADY_EXISTS);
            return;
        }
        var result = {
            handle: handle,
            score: 0,
            token: hash.createHash(handle),    
        };
        store.users[handle] = result;
        var users = Object.keys(store.users).map(function(user) {
            return {handle: user, score: store.users[user].score};
        });
        socket.emit(SOCKET_EVENTS.OUTBOUND.LOGIN_SUCCESS, {user: result, all_users: users});
        socket.broadcast.emit(SOCKET_EVENTS.OUTBOUND.BROADCAST_USERS, users);
        broadcastGameList();
    });

    socket.on(SOCKET_EVENTS.INBOUND.LOGOUT, function(data) {
        delete store.users[data.handle];
        var users = Object.keys(store.users).map(function(user) {
            return {handle: user, score: store.users[user].score};
        });
        socket.broadcast.emit(SOCKET_EVENTS.OUTBOUND.BROADCAST_USERS, users);
        socket.disconnect();
    });

    socket.on(SOCKET_EVENTS.INBOUND.CREATE_GAME, function(data) {
        if(!is_authenticated(socket, data)) return;
        var handle = data.handle;
        var game_params = data.params;
        var game_state = [];
        for(var i=0; i < game_params.cols; i++) {
            var row = [];
            for(var j=0; j < game_params.rows; j++) {
                row.push(-1);
            }
            game_state.push(row);
        }
        game_id++;
        var game = {
            room: null,
            users: [handle],
            state: game_state,
            is_open: false,
            is_complete: false,
            params: game_params,
            name: game_params.cols+"*"+game_params.rows,
            id: game_id
        };

        store.games[game_id] = game;
        socket.emit(SOCKET_EVENTS.OUTBOUND.UPDATE_GAME, game);
        broadcastGameList();
    });

    socket.on(SOCKET_EVENTS.INBOUND.LEAVE_GAME, function(data) {
        if(!is_authenticated(socket, data)) return;
        var handle = data.handle, 
            game = store.games[data.game_id];
        if(game.users.indexOf(handle) !== -1) game.users.splice(game.users.indexOf(handle),1);
        if(game.users.length === 0) delete store.games[data.game_id]
        else {
            if(game.users.length < 2) game.is_open = false
            store.games[data.game_id] = game;
        }
        
        broadcastGameList();
    });

    socket.on(SOCKET_EVENTS.INBOUND.JOIN_GAME, function(data) {
        if(!is_authenticated(socket, data)) return;

        var handle = data.handle,
            game_id = data.game_id;
        if(!(game_id in store.games) || store.games[game_id].is_complete) {
            socket.emit(SOCKET_EVENTS.OUTBOUND.INVALID_GAME);
            return;
        }

        var game = store.games[game_id];
        if(game.users.indexOf(handle) === -1) {
            game.users.push(handle);
            if(game.users.length === GAME_CONSTANTS.MIN_USERS) game.is_open = true;
        }
        store.games[game_id] = game;
        socket.emit(SOCKET_EVENTS.OUTBOUND.UPDATE_GAME, game);
        broadcastGameList();
    });
});

function broadcastGameList() {
    var game_list = Object.keys(store.games).map(function(key) {
        if(store.games[key].is_complete) return;
        return {
            name: store.games[key].name,
            users: store.games[key].users.length,
            id: key
        }
    });

    io.sockets.emit(SOCKET_EVENTS.OUTBOUND.UPDATE_GAME_LIST, game_list);
}

function is_authenticated(socket, data) {
    var handle = data.handle;
    var token = data.token;
    if(!(handle in store.users) || token != store.users[handle].token) {
        socket.emit(SOCKET_EVENTS.OUTBOUND.NAME_ALREADY_EXISTS);
        return false;
    } else {
        return true;
    }
}