# ze-game
Realtime client-server game based on timeouts.

This is a full stack Javascript app using websockets for communication between the client and server (No Restful APIs :P). I have used some ES6 syntax for ease of development and therefore it will not work on all browsers. For a live demo, you can visit http://ze-game.neelborooah.com.

Technologies used for the client:
1. Socket.io
2. Vanilla JS with a flux-like architecture. I plan to integrate React.js.
3. RandomColor.js for the wonderful colors in the grid.
4. Boostrap and JQeury because I am lazy.

Technologies used on the server:
1. Node.js.
2. Express.
3. Socket.io.

Assumptions:
1. Min matrix value for a game is 1*1 and max is 10*10 because we are storing everything in memory right now (LOL).
2. We are using browser alerts liberally on the client.
3. Timeouts are predefined by the server.
4. I have a Pythonic opinion about comments. Minimal and the code should be clear and understandable without it.

Things to do:
1. Currently are storing everything in memory as a PoC. We need to move to some sort of persistant storage.
2. Better session management in case the same user returns to the page.
3. Handling of higher order matrixes.
4. Unique URLs for each room so that users can share and invite people to a game.
5. Better error handling.
6. Leaderboard.