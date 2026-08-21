import React, { useState, useEffect, useRef } from 'react';

// --- PIXEL ART ENGINE (No external images) ---
// Simple 10x10 grids. Letters map to colors.
const PIXEL_COLORS = {
  '.': 'transparent',
  'W': '#ffffff', // White
  'P': '#ff99cc', // Pink
  'B': '#000000', // Black
  'G': '#33cc33', // Green
  'R': '#ff3300', // Red
  'Y': '#ffff00', // Yellow
  'C': '#00ccff', // Cyan
  'M': '#ff00ff', // Magenta
  'D': '#b380ff', // Dark purple
};

const SPRITES = {
  rabbit_idle: [
    '..WW..WW..',
    '..WW..WW..',
    '..WWWWWW..',
    '.WWPWWPWW.',
    '.WWWWWWWW.',
    '..WBBBBW..',
    '...WWWW...',
    '..WWWWWW..',
    '.WW.WW.WW.',
    'WW......WW'
  ],
  rabbit_hop: [
    '..........',
    '..WW..WW..',
    '..WW..WW..',
    '..WWWWWW..',
    '.WWPWWPWW.',
    '.WWWWWWWW.',
    '..WBBBBW..',
    '...WWWW...',
    '.WWWWWWWW.',
    '..WW..WW..'
  ],
  rainbow_arc: [
    '..........',
    '..RRRRRR..',
    '.RYYYYYYR.',
    'RGCCCCCCGR',
    'RGC....CGR',
    'RG......GR',
    'R........R',
    '..........',
    '..........',
    '..........'
  ],
  dragon_friendly: [
    '....GGGG..',
    '...GGGBBG.',
    '..GGGGGGG.',
    '..GGG..R..',
    '.GGGGGG...',
    '..GGGGGG..',
    '...GGGG...',
    '..GGGGGG..',
    '.GG.GG.GG.',
    'GG......GG'
  ],
  princess_small: [
    '...YYYY...',
    '...YYYY...',
    '..PWWWWP..',
    '...WBBW...',
    '..MMMMMM..',
    '.MMMMMMMM.',
    '.MMMMMMMM.',
    '..MMMMMM..',
    '...WWWW...',
    '..WW..WW..'
  ]
};

const PixelSprite = ({ id, className = '', scale = 4 }) => {
  const grid = SPRITES[id] || SPRITES['rabbit_idle'];
  const size = 10;

  return (
    <div className={`inline-block ${className}`} style={{ width: size * scale, height: size * scale }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" shapeRendering="crispEdges">
        {grid.map((row, y) =>
          row.split('').map((char, x) => (
            char !== '.' && (
              <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={PIXEL_COLORS[char]} />
            )
          ))
        )}
      </svg>
    </div>
  );
};

// --- STORY FRAMES ---
const STORY_FRAMES = {
  start: {
    id: 'start',
    text: 'Rabi, der kleine Hase, sitzt unter einem Regenbogen. Neben ihm liegt ein Ball.',
    focusWord: 'Hase',
    syllables: 'Ha - se',
    sprites: ['rabbit_idle', 'rainbow_arc'],
    question: 'Was soll Rabi tun? Dem Ball folgen oder Freunde suchen?',
    next: { 'ball': 'ball_path', 'freunde': 'friends_path', 'default': 'friends_path' }
  },
  friends_path: {
    id: 'friends_path',
    text: 'Rabi hoppelt los und trifft einen freundlichen Drachen am See.',
    focusWord: 'Drache',
    syllables: 'Dra - che',
    sprites: ['rabbit_idle', 'dragon_friendly'],
    question: 'Was machen sie? Ein Feuer anzünden oder schwimmen?',
    next: { 'feuer': 'end', 'schwimmen': 'end', 'default': 'end' }
  },
  ball_path: {
    id: 'ball_path',
    text: 'Der Ball rollt zu einer kleinen Prinzessin im Wald.',
    focusWord: 'Prinzessin',
    syllables: 'Prin - zes - sin',
    sprites: ['rabbit_idle', 'princess_small'],
    question: 'Spielen sie fangen oder verstecken?',
    next: { 'fangen': 'end', 'verstecken': 'end', 'default': 'end' }
  },
  end: {
    id: 'end',
    text: 'Sie spielen zusammen bis die Sonne untergeht. Zeit zum Schlafen!',
    focusWord: 'Schlafen',
    syllables: 'Schla - fen',
    sprites: ['rabbit_idle'],
    question: 'Möchtest du die Geschichte nochmal spielen?',
    next: { 'ja': 'start', 'default': 'start' }
  }
};

// --- MAIN APP COMPONENT ---
export default function RabbitSimulator() {
  const [started, setStarted] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(true);
  const [gameState, setGameState] = useState('idle'); // idle, reading_story, stage1, stage2, stage3, ask_question, listening_choice
  const [currentFrame, setCurrentFrame] = useState(STORY_FRAMES.start);
  const [history, setHistory] = useState([]);

  const [highlightedWordIdx, setHighlightedWordIdx] = useState(-1);
  const [attempts, setAttempts] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [rabbitAnim, setRabbitAnim] = useState('rabbit_idle');
  const [chatInput, setChatInput] = useState('');

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const currentFrameRef = useRef(currentFrame);
  const gameStateRef = useRef(gameState);
  const attemptsRef = useRef(attempts);

  // Keep refs in sync with state
  useEffect(() => { currentFrameRef.current = currentFrame; }, [currentFrame]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { attemptsRef.current = attempts; }, [attempts]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setHasSpeechSupport(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'de-DE';
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim().toLowerCase();
        console.log('ASR Heard:', transcript);
        handleVoiceInput(transcript);
      };

      recognition.onerror = (event) => {
        console.error('ASR Error', event.error);
        if (event.error === 'no-speech') {
          handleVoiceInput('');
        }
      };

      recognitionRef.current = recognition;
    } else {
      setHasSpeechSupport(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inject Font
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const speak = (text, callback, onBoundary) => {
    if (synthRef.current.speaking) synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.85;

    if (onBoundary) utterance.onboundary = onBoundary;
    utterance.onend = () => {
      if (callback) setTimeout(callback, 500);
    };
    synthRef.current.speak(utterance);
  };

  const listen = () => {
    try {
      if (recognitionRef.current) recognitionRef.current.start();
    } catch (e) {
      console.warn('Mic already listening or blocked', e);
    }
  };

  const startGame = () => {
    setStarted(true);
    playStoryFrame(STORY_FRAMES.start);
  };

  const playStoryFrame = (frame) => {
    setCurrentFrame(frame);
    currentFrameRef.current = frame;
    setGameState('reading_story');
    gameStateRef.current = 'reading_story';
    setHighlightedWordIdx(-1);

    const words = frame.text.split(' ');

    speak(frame.text, () => {
      setHighlightedWordIdx(-1);
      enterStage1(frame);
    }, (event) => {
      const charIndex = event.charIndex;
      let currentLength = 0;
      for (let i = 0; i < words.length; i++) {
        currentLength += words[i].length + 1;
        if (charIndex < currentLength) {
          setHighlightedWordIdx(i);
          break;
        }
      }
    });
  };

  const enterStage1 = (frame) => {
    setGameState('stage1');
    gameStateRef.current = 'stage1';
    setFeedbackMsg('');
    speak(`${frame.syllables}. ${frame.focusWord}.`, () => {
      enterStage2();
    });
  };

  const enterStage2 = () => {
    setGameState('stage2');
    gameStateRef.current = 'stage2';
    speak('Lass uns das zusammen sagen.', () => {
      setFeedbackMsg('🎤 Hör zu...');
      listen();
    });
  };

  const enterStage3 = () => {
    setGameState('stage3');
    gameStateRef.current = 'stage3';
    setAttempts(0);
    attemptsRef.current = 0;
    setRabbitAnim('rabbit_idle');
    speak('Jetzt sag du das Wort ganz alleine! Ich höre zu.', () => {
      setFeedbackMsg('🎤 Sag es alleine...');
      listen();
    });
  };

  const handleVoiceInput = (rawTranscript) => {
    let transcript = rawTranscript;
    const frame = currentFrameRef.current;
    const state = gameStateRef.current;
    const targetWord = frame.focusWord.toLowerCase().replace(/[.,!?;:]/g, '');
    transcript = transcript.replace(/[.,!?;:]/g, '');

    if (state === 'stage2') {
      if (transcript.includes(targetWord) || transcript.length > 2) {
        setRabbitAnim('rabbit_hop');
        setFeedbackMsg('✨ Super!');
        setTimeout(() => enterStage3(), 2000);
      } else {
        speak('Nochmal zusammen: ' + frame.focusWord, listen);
      }
    } else if (state === 'stage3') {
      if (transcript.includes(targetWord)) {
        setRabbitAnim('rabbit_hop');
        setFeedbackMsg('🌟 PERFEKT! 🌟');
        speak(`Super, das war ${frame.focusWord}! Du hast es ganz alleine gesagt.`, () => {
          askQuestion(frame);
        });
      } else {
        const newAttempts = attemptsRef.current + 1;
        setAttempts(newAttempts);
        attemptsRef.current = newAttempts;

        if (newAttempts >= 5) {
          setFeedbackMsg('Tolle Übung! 🌈');
          speak('Das war schon viel Übung! Wir machen später weiter. Jetzt geht die Geschichte weiter.', () => {
            askQuestion(frame);
          });
        } else {
          setFeedbackMsg(`Fast! (${newAttempts}/5)`);
          speak(`Fast! Ich helfe dir: ${frame.syllables}. ${frame.focusWord}.`, listen);
        }
      }
    } else if (state === 'listening_choice') {
      let nextFrameId = frame.next['default'];
      for (const [key, val] of Object.entries(frame.next)) {
        if (transcript.includes(key)) nextFrameId = val;
      }

      setHistory(prev => [...prev, frame.text]);
      playStoryFrame(STORY_FRAMES[nextFrameId]);
    }
  };

  const askQuestion = (frame) => {
    setGameState('ask_question');
    gameStateRef.current = 'ask_question';
    setFeedbackMsg('');
    setRabbitAnim('rabbit_idle');
    speak(frame.question, () => {
      setGameState('listening_choice');
      gameStateRef.current = 'listening_choice';
      setFeedbackMsg('🎤 Was soll passieren?');
      listen();
    });
  };

  // --- RENDER HELPERS ---
  const renderStoryText = () => {
    const words = currentFrame.text.split(' ');
    return (
      <div className="text-center leading-loose text-sm p-4">
        {words.map((w, i) => (
          <span
            key={i}
            className={`inline-block mx-1 transition-all duration-300 ${
              i === highlightedWordIdx
                ? 'text-white scale-110'
                : 'text-gray-400'
            }`}
            style={i === highlightedWordIdx ? { filter: 'drop-shadow(0 0 8px #ff00ff)' } : {}}
          >
            {w}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-neutral-900 flex items-center justify-center p-4"
      style={{ fontFamily: "'Press Start 2P', cursive" }}
    >
      {/* Hardware Device Simulator (Rabbit R1 Casing) */}
      <div className="relative w-[340px] h-[650px] bg-[#ff4d00] rounded-3xl flex items-center justify-center shadow-2xl border-4 border-[#cc3d00]">

        {/* Camera/Wheel mock */}
        <div className="absolute right-2 top-20 w-8 h-16 bg-black rounded-lg border-2 border-neutral-800"></div>

        {/* Screen Viewport */}
        <div className="w-[314px] h-[627px] bg-black rounded-xl overflow-hidden relative flex flex-col">

          {!started ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <PixelSprite id="rabbit_hop" scale={6} className="mb-8" />
              <h1
                className="text-white text-xl mb-4"
                style={{ filter: 'drop-shadow(0 0 10px #ff00ff)' }}
              >
                RABI
              </h1>
              <p className="text-green-400 text-[10px] leading-relaxed mb-8">
                Dein pixeliger Freund aus dem orangenen Kasten.
              </p>
              <button
                onClick={startGame}
                className="bg-[#ff4d00] text-white text-[10px] py-4 px-6 rounded hover:bg-white hover:text-[#ff4d00] transition-colors border-2 border-transparent hover:border-[#ff4d00]"
              >
                Simulation Starten
              </button>
            </div>
          ) : (
            <>
              {/* Top Area: Text & History (60%) */}
              <div className="h-[60%] flex flex-col border-b border-neutral-800 relative p-2">

                {/* History (Faded) */}
                <div className="h-1/3 overflow-hidden text-[8px] text-neutral-600 leading-relaxed opacity-50 flex flex-col justify-end pb-2">
                  {history.slice(-2).map((h, i) => <div key={i} className="mb-2">{h}</div>)}
                </div>

                {/* Active Text Display */}
                <div className="flex-1 flex items-center justify-center relative">
                  {gameState === 'reading_story' && renderStoryText()}

                  {['stage1', 'stage2', 'stage3'].includes(gameState) && (
                    <div className="text-center animate-pulse">
                      <div
                        className="text-white text-2xl mb-4"
                        style={{ filter: 'drop-shadow(0 0 15px #00ccff)' }}
                      >
                        {currentFrame.syllables}
                      </div>
                      <div className="text-green-400 text-xs">
                        {gameState === 'stage1' ? 'Hör zu...' :
                          gameState === 'stage2' ? 'Zusammen!' :
                            'Alleine!'}
                      </div>
                    </div>
                  )}

                  {['ask_question', 'listening_choice'].includes(gameState) && (
                    <div className="text-center p-4">
                      <div
                        className="text-yellow-400 text-sm leading-loose"
                        style={{ filter: 'drop-shadow(0 0 5px #ffff00)' }}
                      >
                        {currentFrame.question}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Area: Sprites & Status (40%) */}
              <div className="h-[40%] bg-gradient-to-b from-neutral-900 to-black relative flex items-end justify-center pb-8 px-4">

                {/* Feedback Toast */}
                {!hasSpeechSupport && ['stage2', 'stage3', 'listening_choice'].includes(gameState) && (
                  <div className="absolute top-12 left-0 w-full flex justify-center px-4 z-10">
                    <form
                      className="w-full flex space-x-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if(chatInput.trim()) {
                          handleVoiceInput(chatInput);
                          setChatInput('');
                        }
                      }}
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Antwort tippen..."
                        className="flex-1 bg-black text-white text-[8px] px-2 py-1 rounded border border-neutral-700 outline-none focus:border-[#ff4d00]"
                      />
                      <button type="submit" className="bg-[#ff4d00] text-white text-[8px] py-1 px-2 rounded">
                        Senden
                      </button>
                    </form>
                  </div>
                )}
                {feedbackMsg && (
                  <div className="absolute top-4 left-0 w-full text-center text-[10px] text-white animate-bounce"
                    style={{ filter: 'drop-shadow(0 0 5px #fff)' }}
                  >
                    {feedbackMsg}
                  </div>
                )}

                {/* Sprites Container (Max 2) */}
                <div className="flex justify-between w-full items-end">
                  {currentFrame.sprites.map((spriteId, index) => (
                    <div
                      key={index}
                      className={`transition-transform duration-300 ${
                        spriteId.includes('rabbit') ? (rabbitAnim === 'rabbit_hop' ? '-translate-y-4' : '') : ''
                      }`}
                    >
                      <PixelSprite
                        id={spriteId.includes('rabbit') ? rabbitAnim : spriteId}
                        scale={5}
                      />
                    </div>
                  ))}
                </div>

                {/* Microphone Active Indicator */}
                {['stage2', 'stage3', 'listening_choice'].includes(gameState) && (
                  <div
                    className="absolute bottom-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse"
                    style={{ boxShadow: '0 0 10px #ff0000' }}
                  ></div>
                )}
              </div>
            </>
          )}

          {/* Scanline Overlay for Retro Feel */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.25) 50%)',
              backgroundSize: '100% 4px'
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}
