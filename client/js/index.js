var SERVER = 'http://localhost:3000';
var socket = null;

var SOCKET_EVENTS = {
    OUTBOUND: {
        LOGIN: 'login',
        LOGOUT: 'logout',    
        CREATE_GAME: 'create_game',
        LEAVE_GAME: 'leave_game',
        JOIN_GAME: 'join_game',
        ACQUIRE_SQUARE: 'acquire_square',
    }, 
    INBOUND: {
        NAME_ALREADY_EXISTS: 'name_already_exists',
        LOGIN_SUCCESS: 'login_success',
        BROADCAST_USERS: 'broadcast_user',
        INVALID_TOKEN: 'invalid_token',
        UPDATE_GAME: 'update_game',
        UPDATE_GAME_LIST: 'update_game_list',
        INVALID_GAME: 'invalid_game',
    }
}

var store = {
	users: [],
	this_user: null,
	games: [],
	current_game: null,
};

var actions = {
	ADD_USER: 1,
	ADD_ALL_USERS: 2,
	INITIALIZE: 3,
	LOGOUT: 4,
	UPDATE_GAME_LIST: 5,
	UPDATE_CURRENT_GAME: 6,
};

function updateStore(action) {
	switch(action.type) {
		case actions.ADD_USER:
			store.this_user = action.user;
			break;
		case actions.ADD_ALL_USERS:
			store.users = action.users;
			break;
		case actions.LOGOUT:
			store.users = action.users;
			store.this_user = action.this_user;
			break;
		case actions.UPDATE_GAME_LIST:
			store.games = action.games;
			break;
		case actions.UPDATE_CURRENT_GAME:
			store.current_game = action.current_game;
			break;
		default:
			break;
	}
	render();
}

function render() {
	var htmlString = '';
	if(store.this_user === null) {
		htmlString = `
			<hr />
			<form id="login-form">
				<div class="col-md-8">
					<input type="text" id="handle" class="form-control" placeholder="Please enter your handle!"/>
				</div>
				<div class="col-md-4">
					<input type="submit" class="btn btn-success" value="Login" />
				</div>
			</form>
		`;
	} else if(store.current_game !== null) {
		var rows = store.current_game.params.rows, 
			cols = store.current_game.params.cols,
			grid_html = "";

		var score_html = "";
		for(var key in store.current_game.scores) {
			score_html += `
				<div class="col-md-6">
					${key} : ${store.current_game.scores[key]} 
					<span class="grid_box_demo" style="background:${store.current_game.colors[key]}"></span>
				</div>`;
		}

		for(var i=0;i<rows;i++) {
			grid_html += "<div class='grid_row'>";
			for(var j=0;j<cols;j++) {
				var is_taken = store.current_game.state[i][j] !== -1
				grid_html+= "<a href='#' class='grid_box' data-row="+i+" data-col="+j+" style='background:"+
					((is_taken)?store.current_game.colors[store.current_game.state[i][j]]:"#2f364a")+"'></a>";
			}
			grid_html += "</div>";
		}
		htmlString = `
			<div>
				<p>
					You are playing ${store.current_game.name} against ${store.current_game.users.length-1} players.
					<a href="#" data-id=${store.current_game.id} class="leave_game_link btn btn-danger">Leave</a>
				</p>
				<div class="scores row">
					${score_html}
				</div>
				<div class="grid">
					${grid_html}
				</div>
			</div>
		`;
	} else {
		var game_rows = "<p>There are "+store.games.length+" games active right now.</p>";
		store.games.forEach(function(game) {
			game_rows += `
				<div class="row">
					<div class="col-md-4">${game.name}</div>
					<div class="col-md-4">${game.users} users playing</div>
					<div class="col-md-4">
						<a href="#" data-id=${game.id} class="join_game_link btn btn-primary">Join</a>
					</div>
				</div>
			`;
		});
		htmlString = `
			<div>
				Hi ${store.this_user.handle}, there are ${store.users.length} users online right now!
				<a href="#" id="logout" class="btn btn-danger">Logout</a>
			</div>
			<div>${game_rows}</div>
			<hr />
			<form id="create-game">
				<div class="col-md-4">
					<input type="number" class="form-control" placeholder="columns" id="cols"/>
				</div>
				<div class="col-md-4">
					<input type="number" class="form-control" placeholder="rows" id="rows"/>
				</div>
				<div class="col-md-4">
					<input type="submit" class="btn btn-success" value="Create Game!" />
				</div>
			</form>
		`;
	}

	$("#content").html("<div class='col-md-6 col-md-offset-3 text-center'>"+htmlString+"</div>");
}

function addUser(data) {
	updateStore({
		type: actions.ADD_USER,
		user: data
	});
}

function addAllUsers(data) {
	updateStore({
		type: actions.ADD_ALL_USERS,
		users: data
	});
}

function genericUpdate() {
	updateStore({type: actions.INITIALIZE});
}

function logout() {
	updateStore({
		type: actions.LOGOUT, 
		users: [],
		this_user: null
	});
}

function updateGamelist(data) {
	updateStore({
		type: actions.UPDATE_GAME_LIST,
		games: data
	});
}

function updateCurrentGame(data) {
	updateStore({
		type: actions.UPDATE_CURRENT_GAME,
		current_game: data
	});
}

/* Event Binding | Start Here */

$(document).on("submit", "#login-form", function(e) {
	e.preventDefault();
	var handle = $("#handle").val().trim();
	if(handle.length === 0) {
		alert("Please enter some data!");
		return;
	}
	socket.emit(SOCKET_EVENTS.OUTBOUND.LOGIN, {handle: handle});
});

$(document).on("click", "#logout", function(e) {
	e.preventDefault();
	socket.emit(SOCKET_EVENTS.OUTBOUND.LOGOUT, {handle: store.this_user.handle});
	logout();
});

$(document).on('submit', '#create-game', function(e) {
	e.preventDefault();
	var cols = $("#cols").val().trim();
	var rows = $("#rows").val().trim();
	if(cols.length === 0 || rows.length === 0 || parseInt(cols) < 1 || parseInt(rows) < 1) {
		alert("Please enter a natural number!");
		return;
	}
	var data = {
		handle: store.this_user.handle,
		token: store.this_user.token,
		params: {
			cols: parseInt(cols),
			rows: parseInt(rows),
		}
	};
	socket.emit(SOCKET_EVENTS.OUTBOUND.CREATE_GAME, data);
});

$(document).on('click', '.join_game_link', function(e) {
	e.preventDefault();
	var game_id = parseInt($(this).data('id'));
	var data = {
		handle: store.this_user.handle,
		token: store.this_user.token,
		game_id: game_id
	}
	socket.emit(SOCKET_EVENTS.OUTBOUND.JOIN_GAME, data);
});

$(document).on('click', '.leave_game_link', function(e) {
	e.preventDefault();
	var game_id = parseInt($(this).data('id'));
	var data = {
		handle: store.this_user.handle,
		token: store.this_user.token,
		game_id: game_id
	}
	socket.emit(SOCKET_EVENTS.OUTBOUND.LEAVE_GAME, data);
	updateCurrentGame(null);
});

$(document).on('click', '.grid_box', function(e) {
	e.preventDefault();
	var row = parseInt($(this).data('row'));
	var col = parseInt($(this).data('col'));
	var data = {
		handle: store.this_user.handle,
		token: store.this_user.token,
		game_id: store.current_game.id,
		row: row,
		col: col,
	}
	socket.emit(SOCKET_EVENTS.OUTBOUND.ACQUIRE_SQUARE, data);
});

$(document).ready(function(){
	genericUpdate();
	
	socket = io.connect(SERVER);
	
	socket.on(SOCKET_EVENTS.INBOUND.NAME_ALREADY_EXISTS, function(data) {
		var node = $("#handle");
		console.log(SOCKET_EVENTS.INBOUND.NAME_ALREADY_EXISTS, data);
		if(node.length !== 0) {
			alert("Someone else has already registered with this handle!");
			node.val("");
		}
	});

	socket.on(SOCKET_EVENTS.INBOUND.LOGIN_SUCCESS, function(data) {
		console.log(SOCKET_EVENTS.INBOUND.LOGIN_SUCCESS, data);
		addUser(data.user);
		addAllUsers(data.all_users);
	});

	socket.on(SOCKET_EVENTS.INBOUND.BROADCAST_USERS, function(data) {
		console.log(SOCKET_EVENTS.INBOUND.BROADCAST_USERS, data);
		addAllUsers(data);
	});

	socket.on(SOCKET_EVENTS.INBOUND.UPDATE_GAME_LIST, function(data) {
		console.log(SOCKET_EVENTS.INBOUND.UPDATE_GAME_LIST, data);
		updateGamelist(data);
	});

	socket.on(SOCKET_EVENTS.INBOUND.UPDATE_GAME, function(data) {
		console.log(SOCKET_EVENTS.INBOUND.UPDATE, data);
		if(data !== null) {
			var colors = randomColor({count: data.users.length});
			data.colors = {};
			for(var i=0; i < data.users.length; i++) {
				data.colors[data.users[i]] = colors[i];
			}
		}
		updateCurrentGame(data);
		if(data !== null && data.remaining_squares === 0) {
			var max_score = 0;
			for(var key in data.scores) {
				max_score = Math.max(data.scores[key], max_score);
			}
			var msg = (data.scores[store.this_user.handle] === max_score)?"You won!":"You lost...";
			alert(msg);
			updateCurrentGame(null);
		}
	});
});
