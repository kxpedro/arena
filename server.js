const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const port = 3000;

const jsonCharstest = require('./json/charstest.json');
const jsonUsers = require('./json/users.json');

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" } // Libere o CORS para testes
});

if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  localStorage = new LocalStorage('./scratch');
}

app.use(express.json());
app.use(express.static(__dirname));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html'); 
app.set('views', __dirname);

let waitingPlayers = [];
const activeGames = {}; // Object to store active games and their players

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Event for a player to join the matchmaking queue
    socket.on('findMatch', () => {
        // Add the current player to the waiting list
        waitingPlayers.push(socket.id);
        console.log('Player', socket.id, 'joined queue. Current queue length:', waitingPlayers.length);

        // Check if there are enough players to start a match
        if (waitingPlayers.length >= 2) {
            const player1Id = waitingPlayers.shift();
            const player2Id = waitingPlayers.shift();
            const gameId = 'game_' + Math.random().toString(36).substr(2, 9); // Generate a unique game ID

            // Get the actual socket objects for the players
            const player1Socket = io.sockets.sockets.get(player1Id);
            const player2Socket = io.sockets.sockets.get(player2Id);

            if (player1Socket && player2Socket) {
                // Have both players join the same private room
                player1Socket.join(gameId);
                player2Socket.join(gameId);

                // Store game state in activeGames object (server-side only, no DB call)
                activeGames[gameId] = {
                    player1: player1Id,
                    player2: player2Id,
                    // ... other game specific data (scores, turns, etc)
                };

                console.log('Match started for Game ID:', gameId, 'Players:', player1Id, player2Id);

                // Notify both players that a match has been found and provide the gameId
                io.to(gameId).emit('matchFound', { gameId: gameId, opponentId: player2Id }); // Can tailor message for each player
            } else {
                // If a player disconnected before match found, put the other back in queue
                if (player1Socket) waitingPlayers.push(player1Id);
                if (player2Socket) waitingPlayers.push(player2Id);
            }
        } else {
            // Notify the player they are waiting
            socket.emit('waitingForOpponent');
        }
    });

    // Handle game events within the specific game room
    socket.on('gameAction', (data) => {
        const { gameId, action } = data;
        // Broadcast the action to the *other* player in the same room
        socket.to(gameId).emit('opponentAction', action);
    });

    // Handle player disconnections
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        // Remove from waiting queue
        waitingPlayers = waitingPlayers.filter(id => id !== socket.id);

        // Check if they were in an active game and notify the opponent
        for (const gameId in activeGames) {
            if (activeGames[gameId].player1 === socket.id || activeGames[gameId].player2 === socket.id) {
                const opponentId = activeGames[gameId].player1 === socket.id ? activeGames[gameId].player2 : activeGames[gameId].player1;
                io.to(opponentId).emit('opponentDisconnected');
                delete activeGames[gameId]; // Clean up the game
                break;
            }
        }
    });
});

app.get('/', (req, res) => {  
  res.render(path.join(__dirname, 'index'));
});

app.get('/jogar', (req, res) => {
  localStorage.removeItem('loggedUser');
  localStorage.removeItem('recursosJogador');
  localStorage.removeItem('recursosCPU');
  localStorage.removeItem('turno');

  //Validar se usuário existe.
  var user = jsonUsers.users.find(user => user.username === req.query.username && user.password === req.query.password);
  if(!user){
    return res.status(401).send('Invalid username or password');
  }
  
  localStorage.setItem('loggedUser', JSON.stringify(user));
  res.render('game', { jsonData: jsonCharstest, user: user });
});

app.get('/partida', (req, res) => {
  const time = JSON.parse(localStorage.getItem('time'));
  const timePersonagens = time.map(id => jsonCharstest.characters.find(personagem => personagem.charid == parseInt(id)));
 
  const timeCPU = [1,2,3]; // implementar RNG
  const timePersonagensCPU = timeCPU.map(id => jsonCharstest.characters.find(personagem => personagem.charid == parseInt(id)));

  var recursosJogador;
  var recursosCPU;

  var localRecursosJogador = localStorage.getItem('recursosJogador');
  var localRecursosCPU = localStorage.getItem('recursosCPU');

  if(!localStorage.getItem('recursosJogador') || !localStorage.getItem('recursosCPU'))
  {
    recursosJogador = 
    [
      {"energyType" : "red", "amount": 0},
      {"energyType" : "blue", "amount": 0},
      {"energyType" : "yellow", "amount": 0},
      {"energyType" : "white", "amount": 0},
      {"energyType" : "purple", "amount": 0}
    ];

    recursosCPU = 
    [
      {"energyType" : "red", "amount": 0},
      {"energyType" : "blue", "amount": 0},
      {"energyType" : "yellow", "amount": 0},
      {"energyType" : "white", "amount": 0},
      {"energyType" : "purple", "amount": 0}
    ];
    
    localStorage.setItem('recursosJogador', JSON.stringify(recursosJogador));
    localStorage.setItem('recursosCPU', JSON.stringify(recursosCPU));
  }else
  {
    recursosJogador = JSON.parse(localStorage.getItem('recursosJogador'));
    recursosCPU = JSON.parse(localStorage.getItem('recursosCPU'));
  }

  const jogadorAtual = 0; // 0 indica o jogador, 1 indica o CPU
  const contadordeTurnos = 0;
  const turno = { jogadorAtual, contadordeTurnos };

  localStorage.setItem('turno', JSON.stringify(turno));

  const partidaOffline = { timePersonagens, timePersonagensCPU, recursosJogador, recursosCPU, turno};

  partidaOffline.timePersonagens = timePersonagens;
  partidaOffline.timePersonagensCPU = timePersonagensCPU; 
  partidaOffline.recursosJogador = recursosJogador;
  partidaOffline.recursosCPU = recursosCPU;
  partidaOffline.turno = turno;

  res.render('matchoffline', {partidaOffline: partidaOffline});
});

app.get('/validarUsoSkills', (req, res) => {

  var recursosJogador = JSON.parse(localStorage.getItem('recursosJogador'));
  const time = JSON.parse(localStorage.getItem('time'));
  const timePersonagens = time.map(id => jsonCharstest.characters.find(personagem => personagem.charid == parseInt(id)));

  timePersonagens.forEach(personagem => {    
    personagem.skills.forEach(skill => {
      const recursoSkill = skill.energycost; //red, yellow, blue, etc
      if(recursoSkill.red){
        if(recursosJogador.find(eng => eng.energyType == "red" ).amount >= recursoSkill.red)        {
          skill.usable = true;
        }
      }

    });

  });



  res.send(timePersonagens);

});

app.post('/salvartime', (req, res) => {
    const formData = req.body;
    localStorage.setItem('time', JSON.stringify(formData));
    res.sendStatus(200);
});

app.post('/passarTurno', (req, res) => {

  const turno = JSON.parse(localStorage.getItem('turno'));
  turno.contadordeTurnos++;
  
  const turnoAtual = turno.jogadorAtual;

  console.log("Contador de Turnos: ", turno.contadordeTurnos);
  console.log("Jogador Atual: ", turno.jogadorAtual == 0 ? "Jogador" : "CPU" );

  const recursosJogador = JSON.parse(localStorage.getItem('recursosJogador')); // carrega os dados do servidor ao inves do client, pois o client pode enviar dados incorretos, por isso req.body foi removido
  const recursosCPU = JSON.parse(localStorage.getItem('recursosCPU')) || [];

  if(turno.jogadorAtual === 0) //Jogador
  {    
    // --- geração de energia do jogador ---
    const RNG = Math.floor(Math.random() * 4) + 1;

    switch (RNG) {
      case 1:
        console.log("Red");
        recursosJogador.find(eng => eng.energyType == "red" ).amount++;
        break;
      case 2:
        console.log("Blue");
        const energyBlue = recursosJogador.find(eng => eng.energyType == "blue" );
        energyBlue.amount++;
        break;      
      case 3: 
        console.log("Yellow");
        const energyYellow = recursosJogador.find(eng => eng.energyType == "yellow" );
        energyYellow.amount++;        
        break;  
      case 4:
        console.log("White");
        const energyWhite = recursosJogador.find(eng => eng.energyType == "white" );
        energyWhite.amount++;
        break;  
      case 5:
        console.log("Purple");
        const energyPurple = recursosJogador.find(eng => eng.energyType == "purple" );
        energyPurple.amount++;
        break;  
    }
  }
  else //CPU
  {    
    // geração de energia do CPU

    const rngCPU = Math.floor(Math.random() * 4) + 1;

    switch (rngCPU) {
      case 1:
        console.log("Red CPU");
        recursosCPU.find(eng => eng.energyType == "red" ).amount++;
        break;
      case 2:
        console.log("Blue CPU");
        const energyBlue = recursosCPU.find(eng => eng.energyType == "blue" );
        energyBlue.amount++;
        break;
      case 3: 
        console.log("Yellow CPU");
        const energyYellow = recursosCPU.find(eng => eng.energyType == "yellow" );
        energyYellow.amount++;        
        break;
      case 4:
        console.log("White CPU"); 
        const energyWhite = recursosCPU.find(eng => eng.energyType == "white" );
        energyWhite.amount++;
        break;
      case 5:
        console.log("Purple CPU");
        const energyPurple = recursosCPU.find(eng => eng.energyType == "purple" );
        energyPurple.amount++;
        break;  
    }
  }
  
  const trocarTurnoJogador = turno.jogadorAtual === 0 ? 1 : 0; // alterna entre 0 e 1
  turno.jogadorAtual = trocarTurnoJogador;  
  localStorage.setItem('turno', JSON.stringify(turno));

  console.log("Recursos do jogador após o turno:", recursosJogador);
  console.log("Recursos do CPU após o turno:", recursosCPU);

  localStorage.setItem('recursosJogador', JSON.stringify(recursosJogador));
  localStorage.setItem('recursosCPU', JSON.stringify(recursosCPU));

  const dadosPartida = {
    recursosJogador: recursosJogador,
    recursosCPU: recursosCPU,
    turno: turno
  };

  if(turno.jogadorAtual === 0) {
    console.log("Turno do Jogador");
    setTimeout(() => {
      res.send(dadosPartida);
    }, 3000);
  }
  else 
    {
      console.log("Turno do CPU");
      res.send(dadosPartida);
  }  
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});