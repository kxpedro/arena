const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

const jsonCharstest = require('./json/charstest.json');
const { json } = require('stream/consumers');

if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  localStorage = new LocalStorage('./scratch');
}

app.use(express.json());
app.use(express.static(__dirname));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html'); 
app.set('views', __dirname);

app.get('/', (req, res) => {
  res.render(path.join(__dirname, 'index'));
});

app.get('/jogar', (req, res) => {
  res.render('game', { jsonData: jsonCharstest });
  localStorage.removeItem('recursosJogador');
  localStorage.removeItem('recursosCPU');
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

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});