var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var counter = 0;

server.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});

app.get('/', function (req, res) {
      res.sendfile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
    socket.emit('news', { hello: 'world' });
    socket.on('my other event', function (data) {
        console.log(data);
    });
    socket.on('update_counter', function() {
        counter++;
        console.log("counter: " + counter);
        socket.emit('updated_counter', {counter: counter});
        socket.broadcast.emit('updated_counter', {counter: counter});
    });
});
