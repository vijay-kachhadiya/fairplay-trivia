// The question bank. This is the ONE file Vijay swaps to change the whole game.
// Faith, sports, pop culture, corporate onboarding, product trivia for a launch,
// the engine does not care. Each question carries its correct answer HERE, on the
// server side. This object is written to Firestore (server only). The version the
// phone receives is a projection with correctChoiceId removed. See functions/index.js
// openQuestion().
//
// Keep it neutral and tasteful for the demo. Five questions is enough to show the
// full round loop: open, close, reveal, leaderboard, repeat, match end.

const QUESTION_BANK = [
  {
    id: 'q1',
    index: 0,
    prompt: 'Which planet is known as the Red Planet?',
    choices: [
      { id: 'a', label: 'Venus' },
      { id: 'b', label: 'Mars' },
      { id: 'c', label: 'Jupiter' },
      { id: 'd', label: 'Saturn' }
    ],
    correctChoiceId: 'b'
  },
  {
    id: 'q2',
    index: 1,
    prompt: 'What is the largest ocean on Earth?',
    choices: [
      { id: 'a', label: 'Atlantic' },
      { id: 'b', label: 'Indian' },
      { id: 'c', label: 'Pacific' },
      { id: 'd', label: 'Arctic' }
    ],
    correctChoiceId: 'c'
  },
  {
    id: 'q3',
    index: 2,
    prompt: 'Who painted the Mona Lisa?',
    choices: [
      { id: 'a', label: 'Vincent van Gogh' },
      { id: 'b', label: 'Pablo Picasso' },
      { id: 'c', label: 'Claude Monet' },
      { id: 'd', label: 'Leonardo da Vinci' }
    ],
    correctChoiceId: 'd'
  },
  {
    id: 'q4',
    index: 3,
    prompt: 'What is the chemical symbol for gold?',
    choices: [
      { id: 'a', label: 'Au' },
      { id: 'b', label: 'Gd' },
      { id: 'c', label: 'Ag' },
      { id: 'd', label: 'Go' }
    ],
    correctChoiceId: 'a'
  },
  {
    id: 'q5',
    index: 4,
    prompt: 'How many continents are there on Earth?',
    choices: [
      { id: 'a', label: 'Five' },
      { id: 'b', label: 'Six' },
      { id: 'c', label: 'Seven' },
      { id: 'd', label: 'Eight' }
    ],
    correctChoiceId: 'c'
  }
];

module.exports = { QUESTION_BANK };
