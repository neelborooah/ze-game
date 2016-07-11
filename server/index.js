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
        JOIN_GAME: 'join_game',
        ACQUIRE_SQUARE: 'acquire_square',
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
        for(var i=0; i < game_params.rows; i++) {
            var row = [];
            for(var j=0; j < game_params.cols; j++) {
                row.push(-1);
            }
            game_state.push(row);
        }
        game_id++;
        var game = {
            id: game_id,
            room: game_id,
            name: game_params.cols+"*"+game_params.rows,
            params: game_params,
            users: [handle],
            scores: {},
            state: game_state,
            remaining_squares: game_params.cols*game_params.rows,
            is_open: false,
            is_complete: false,
        };
        game.scores[handle] = 0;
        store.games[game_id] = game;
        socket.join(game.room);
        broadcastGameUpdate(game);
        broadcastGameList();
    });

    socket.on(SOCKET_EVENTS.INBOUND.LEAVE_GAME, function(data) {
        if(!is_authenticated(socket, data)) return;
        var handle = data.handle, 
            game = store.games[data.game_id];
        if(game.users.indexOf(handle) === -1) return;

        game.users.splice(game.users.indexOf(handle),1);
        socket.leave(game.room);
        if(game.users.length === 0) {
            delete store.games[data.game_id];
        } else {
            if(game.users.length < 2) game.is_open = false
            store.games[data.game_id] = game;
            broadcastGameUpdate(game);
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
        game.scores[handle] = 0;
        store.games[game_id] = game;
        socket.join(game.room);
        broadcastGameUpdate(game);
        broadcastGameList();
    });

    socket.on(SOCKET_EVENTS.INBOUND.ACQUIRE_SQUARE, function(data) {
        if(!is_authenticated(socket, data)) return;

        var handle = data.handle,
            game_id = data.game_id, 
            column = data.col, 
            row = data.row;

        if(!(game_id in store.games) || store.games[game_id].is_complete || !store.games[game_id].is_open ||
                store.games[game_id].users.indexOf(handle) === -1 || store.games[game_id].state[row][column] !== -1) {
            socket.emit(SOCKET_EVENTS.OUTBOUND.INVALID_GAME);
            return;
        }

        var game = store.games[game_id];
        game.state[row][column] = handle;
        game.scores[handle]++;
        if(--game.remaining_squares === 0) {
            game.is_complete = true;
            store.games[game_id] = game;
            broadcastGameUpdate(game);
            broadcastGameList();
        } else {
            game.is_open = false;
            broadcastGameUpdate(game);
            setTimeout(function() {
                game.is_open = true;
                store.games[game_id] = game;
                broadcastGameUpdate(game);
            }, GAME_CONSTANTS.TIMEOUT);
        }
    });
});

/* Broadcasts all game states to everyone listening */
function broadcastGameList() {
    var game_list = [];
    for(var key in store.games) {
        if(store.games[key].is_complete) continue;
        game_list.push({
            name: store.games[key].name,
            users: store.games[key].users.length,
            id: key
        });
    }

    io.sockets.emit(SOCKET_EVENTS.OUTBOUND.UPDATE_GAME_LIST, game_list);
}

/* Broadcasts full game state to everyone subscribed to that room */
function broadcastGameUpdate(game) {
    io.to(game.room).emit(SOCKET_EVENTS.OUTBOUND.UPDATE_GAME, game);
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