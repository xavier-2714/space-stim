import { rng } from './util.js';

export const YEAR = '12,117 G.E. · 49 F.E.';

// lore:1 = named in Asimov's "Foundation"; lore:0 = invented for this game.
// Map coordinates are parsecs from the Galactic centre (schematic).
const BOOK = [
  { id: 'terminus', name: 'Terminus', x: 13200, y: -6200, type: 'cold', econ: 'science', hand: 'terminus', station: 1, moons: 1, star: 0xffe0b0,
    faction: 'Encyclopedia Foundation (Imperial charter)', pop: 'about a million',
    desc: 'The only planet of a lone sun at the outermost rim of the Galaxy. Poor in metals, rich in scholars. Settled fifty years ago under Imperial charter by the Encyclopedia Foundation, which is compiling the Encyclopedia Galactica here.' },
  { id: 'anacreon', name: 'Anacreon', x: 12650, y: -5650, type: 'warm', econ: 'feudal', hand: 'anacreon', station: 1, moons: 2, star: 0xfff2d8,
    faction: 'Kingdom of Anacreon', pop: 'billions across the old Prefecture',
    desc: 'Until lately the Imperial Prefecture of Anacreon. Its Royal Governor has taken the title of King, and the Emperor\'s writ no longer runs here. Proud, martial, and Terminus\'s nearest powerful neighbour.' },
  { id: 'smyrno', name: 'Smyrno', x: 12150, y: -6500, type: 'arid', econ: 'feudal', star: 0xffd0a0, moons: 1,
    faction: 'Kingdom of Smyrno', pop: 'unknown',
    desc: 'One of the four kingdoms into which the old Imperial province has broken. A watchful rival of Anacreon.' },
  { id: 'konom', name: 'Konom', x: 12450, y: -4950, type: 'rock', econ: 'mining', star: 0xd8e4ff, moons: 0,
    faction: 'Kingdom of Konom', pop: 'unknown',
    desc: 'One of the four Periphery kingdoms. Like its neighbours it keeps the forms of Empire and none of the obedience.' },
  { id: 'daribow', name: 'Daribow', x: 11850, y: -5450, type: 'jungle', econ: 'agri', star: 0xfff0c0, moons: 1,
    faction: 'Kingdom of Daribow', pop: 'unknown',
    desc: 'One of the four Periphery kingdoms that have slipped from Imperial control.' },
  { id: 'santanni', name: 'Santanni', x: 9800, y: -4200, type: 'ocean', econ: 'industrial', station: 1, star: 0xfff6e8, moons: 1,
    faction: 'Galactic Empire', pop: 'billions',
    desc: 'A populous Imperial world inward of the Periphery. Its regular traffic with the rim has grown thin and uncertain.' },
  { id: 'vega', name: 'Vega', x: 7200, y: -2600, type: 'warm', econ: 'agri', station: 1, star: 0xe6eeff, moons: 2,
    faction: 'Galactic Empire', pop: 'billions',
    desc: 'Seat of a wealthy Imperial province. Vegan tobacco is smoked, and envied, across the Galaxy.' },
  { id: 'trantor', name: 'Trantor', x: -600, y: 400, type: 'city', econ: 'capital', hand: 'trantor', station: 1, moons: 2, star: 0xfff4e0,
    faction: 'Galactic Empire · Imperial capital', pop: 'forty billion',
    desc: 'Capital of the Galactic Empire for twelve thousand years. One city covering one world: forty billion administrators under a skin of metal, fed by the harvests of twenty agricultural planets.' },
  { id: 'synnax', name: 'Synnax', x: -9800, y: 9400, type: 'ocean', econ: 'agri', star: 0xcfe0ff, moons: 1,
    faction: 'Galactic Empire', pop: 'modest',
    desc: 'A quiet provincial world circling a star at the edge of the Blue Drift. Its brightest children leave for Trantor.' },
  { id: 'siwenna', name: 'Siwenna', x: 8200, y: -7900, type: 'warm', econ: 'industrial', station: 1, star: 0xfff0d0, moons: 1,
    faction: 'Galactic Empire · Normannic Sector', pop: 'billions',
    desc: 'Capital of the Normannic Sector: a rich, orderly Imperial province with a viceroy and a garrison.' },
  { id: 'gamma', name: 'Gamma Andromeda', x: 2500, y: -5200, type: 'rock', econ: 'industrial', star: 0xffc890, moons: 0,
    faction: 'Galactic Empire', pop: 'reduced',
    desc: 'Remembered for the catastrophic failure of an atomic power plant on its fifth planet. Trained technicians, it is said, are becoming hard to find.' },
  { id: 'arcturus', name: 'Arcturus', x: 5900, y: 6700, type: 'arid', econ: 'frontier', star: 0xffb070, moons: 1,
    faction: 'Galactic Empire · Sirius Sector', pop: 'modest',
    desc: 'One of the systems that antiquarians propose as the lost birthplace of mankind. The argument is conducted entirely in libraries.' },
  { id: 'sol', name: 'Sol', x: 5200, y: 6100, type: 'rock', econ: 'frontier', star: 0xfff4d6, moons: 1,
    faction: 'Galactic Empire · Sirius Sector', pop: 'sparse',
    desc: 'An obscure system of the Sirius Sector, named by some scholars in the "Origin Question" as a candidate for humanity\'s first home.' },
  { id: 'sirius', name: 'Sirius', x: 5050, y: 5850, type: 'ice', econ: 'mining', star: 0xdfe8ff, moons: 0,
    faction: 'Galactic Empire · Sirius Sector', pop: 'modest',
    desc: 'Seat of the sector that bears its name, and another candidate in the scholars\' Origin Question.' },
  { id: 'alpha', name: 'Alpha Centauri', x: 5380, y: 6200, type: 'ocean', econ: 'agri', star: 0xffe9c0, moons: 0,
    faction: 'Galactic Empire · Sirius Sector', pop: 'modest',
    desc: 'A Sirius Sector system put forward by some archaeologists as the original home of mankind.' },
  { id: 'cygni', name: '61 Cygni', x: 5600, y: 6480, type: 'ice', econ: 'frontier', star: 0xffb884, moons: 1,
    faction: 'Galactic Empire · Sirius Sector', pop: 'sparse',
    desc: 'A dim star of the Sirius Sector that appears in every learned footnote on the Origin Question.' },
  { id: 'korell', name: 'Korell', x: 10600, y: -8700, type: 'arid', econ: 'frontier', star: 0xffdcb0, moons: 1,
    faction: 'Outer province · ties to the Empire lapsing', pop: 'unknown',
    desc: 'An outlying world going its own way as Imperial patrols grow rare.' },
  { id: 'askone', name: 'Askone', x: 11400, y: -2900, type: 'jungle', econ: 'agri', star: 0xfff0c8, moons: 2,
    faction: 'Outer province · ties to the Empire lapsing', pop: 'unknown',
    desc: 'A remote, inward-looking world of the far Periphery, seldom visited.' },
];

const SYL_A = ['Hes', 'Var', 'Ol', 'Tyr', 'Mel', 'Dor', 'Kas', 'Ren', 'Ith', 'Bal', 'Cor', 'Nym', 'Sar', 'Ves', 'Lu', 'Ank', 'Per', 'Zo', 'Hal', 'Eri'];
const SYL_B = ['per', 'da', 'ren', 'tho', 'mi', 'la', 'go', 'ssa', 'ki', 'ven', 'ro', 'na', 'bri', 'the', 'do'];
const SYL_C = ['os', 'ia', 'on', 'ar', 'is', 'um', 'eth', 'ana', 'or', 'ix', 'ene', 'us'];
const TYPES = ['arid', 'ice', 'jungle', 'rock', 'ocean', 'warm', 'cold'];
const ECON = { arid: 'mining', ice: 'frontier', jungle: 'agri', rock: 'mining', ocean: 'agri', warm: 'industrial', cold: 'frontier' };

function invented() {
  const r = rng(4917), out = [];
  const fixed = [
    { name: 'Hesperos Reach', x: 3600, y: -1300 }, { name: 'Varden\'s Crossing', x: 10900, y: -5300 },
    { name: 'Olmeth', x: 6100, y: -5600 }, { name: 'Tyrrin Deep', x: -3800, y: 4600 }, { name: 'Calder Shoal', x: 1500, y: 3400 },
    { name: 'Rimfall', x: 13900, y: -7300 }, { name: 'Lantern Rock', x: 12900, y: -7600 }, { name: 'Morrow', x: -6300, y: 6900 },
  ];
  for (let i = 0; i < 26; i++) {
    let f = fixed[i], x, y, name;
    if (f) { x = f.x; y = f.y; name = f.name; }
    else {
      const a = r() * Math.PI * 2, d = 2500 + r() * 11500;
      x = Math.round(Math.cos(a) * d); y = Math.round(Math.sin(a) * d);
      name = SYL_A[(r() * SYL_A.length) | 0] + SYL_B[(r() * SYL_B.length) | 0] + SYL_C[(r() * SYL_C.length) | 0];
      if (r() < 0.3) name += [' II', ' IV', ' Minor', ' Prime'][(r() * 4) | 0];
    }
    const type = TYPES[(r() * TYPES.length) | 0];
    const dc = Math.hypot(x, y);
    const faction = dc > 11500 ? 'Unaligned · Imperial contact lapsed' : dc > 7500 ? 'Galactic Empire · nominal' : 'Galactic Empire';
    out.push({
      id: 'inv' + i, name, x, y, type, econ: ECON[type], lore: 0, star: [0xfff0d0, 0xffc890, 0xd8e4ff, 0xffe4b8][(r() * 4) | 0],
      moons: (r() * 3) | 0, station: r() < 0.35 ? 1 : 0, faction, pop: 'small',
      desc: dc > 11500
        ? 'A minor Periphery settlement. The last Imperial census ship called here a generation ago.'
        : 'A minor Imperial world, charted and taxed, and otherwise left to itself.',
    });
  }
  return out;
}

export const SYSTEMS = [...BOOK.map((s) => ({ lore: 1, ...s })), ...invented()];
export const SYS = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- economy ----------
export const GOODS = [
  { id: 'food', name: 'Foodstuffs', base: 40 }, { id: 'metal', name: 'Refined Metals', base: 120 },
  { id: 'parts', name: 'Machine Parts', base: 180 }, { id: 'instr', name: 'Scientific Instruments', base: 320 },
  { id: 'films', name: 'Book-Films', base: 90 }, { id: 'textile', name: 'Textiles', base: 70 },
  { id: 'tobacco', name: 'Vegan Tobacco', base: 260 }, { id: 'lux', name: 'Luxury Goods', base: 420 },
];
const MULT = {
  science:    { food: 1.3, metal: 2.2, parts: 1.2, instr: 0.6, films: 0.55, textile: 1.2, tobacco: 1.3, lux: 1.2 },
  feudal:     { food: 0.6, metal: 1.0, parts: 1.7, instr: 1.8, films: 1.3, textile: 0.7, tobacco: 1.2, lux: 1.5 },
  capital:    { food: 1.9, metal: 1.3, parts: 0.9, instr: 1.0, films: 0.7, textile: 1.3, tobacco: 1.5, lux: 0.75 },
  agri:       { food: 0.5, metal: 1.3, parts: 1.4, instr: 1.3, films: 1.2, textile: 0.8, tobacco: 0.6, lux: 1.3 },
  mining:     { food: 1.4, metal: 0.5, parts: 1.2, instr: 1.3, films: 1.2, textile: 1.2, tobacco: 1.2, lux: 1.2 },
  industrial: { food: 1.2, metal: 0.9, parts: 0.6, instr: 0.9, films: 1.0, textile: 0.8, tobacco: 1.1, lux: 1.0 },
  frontier:   { food: 1.2, metal: 1.2, parts: 1.6, instr: 1.5, films: 1.4, textile: 1.3, tobacco: 1.4, lux: 1.6 },
};
export function price(sys, gid) {
  const g = GOODS.find((x) => x.id === gid);
  const r = rng((sys.x * 31 + sys.y * 17 + gid.charCodeAt(0) * 101 + gid.length) | 0)();
  return Math.round(g.base * MULT[sys.econ][gid] * (0.92 + r * 0.16));
}

export const UPGRADES = [
  { id: 'drive', name: 'Hyperdrive coils', tiers: ['Standard coils — 5,000 pc', 'Rewound coils — 8,000 pc', 'Imperial courier coils — 14,000 pc'], vals: [5000, 8000, 14000], cost: [0, 2400, 7500] },
  { id: 'engine', name: 'Sublight engines', tiers: ['Stock thrusters', 'Tuned thrusters (+30%)', 'Naval-grade thrusters (+65%)'], vals: [1, 1.3, 1.65], cost: [0, 1500, 4800] },
  { id: 'hold', name: 'Cargo hold', tiers: ['8 crates', '14 crates', '22 crates'], vals: [8, 14, 22], cost: [0, 1200, 4000] },
];

// ---------- people (all original) ----------
const o = (t, go) => ({ t, go }), act = (t, a) => ({ t, act: a }), bye = (t = 'Good day.') => ({ t, end: 1 });
export const NPCS = {
  // TERMINUS
  t_dock: { name: 'Orsa Venn', role: 'Dockmaster, Terminus City Spaceport', col: 0x3c5a78, n: {
    start: { text: 'Bay Three is yours for as long as the fees are paid, spacer. Not that we are short of room — one ship a week is a busy season out here.', opts: [act('Is there any work going?', 'jobs'), o('Quiet port, then?', 'quiet'), o('What should I know about Terminus?', 'know'), bye()] },
    quiet: { text: 'It was livelier when I was a girl. Supply ships from Santanni came every month. Now the lanes inward run through Anacreon\'s space, and Anacreon has a king who likes to count whatever passes.', opts: [o('And the Empire allows that?', 'empire'), bye('I see.')] },
    empire: { text: 'The Empire is ten thousand parsecs away and has other things on its mind. Out here "allows" is a word for the history books. Mind you, the Board will tell you the Emperor\'s charter protects us. Maybe it does.', opts: [bye('Thanks.')] },
    know: { text: 'Scholars up the hill at the Encyclopedia Hall, everyone else down here keeping them fed. No metals worth the name — we import every girder. If you want a drink, the Rim Light is on Foundation Way. If you want an argument, try City Hall.', opts: [act('About that work…', 'jobs'), bye()] },
  } },
  t_trader: { name: 'Dellin Maur', role: 'Commodity factor, Market Square', col: 0x8a5a2a, n: {
    start: { text: 'Buying or selling? I\'ll warn you now: metals cost the sky on Terminus. There isn\'t enough iron in this planet\'s crust to make a decent frying pan.', opts: [act('Show me your prices.', 'trade'), o('What sells well off-world?', 'tips'), bye()] },
    tips: { text: 'Instruments and book-films. It is the one thing we make better than anybody for a thousand parsecs. The kingdoms pay well for instruments, though they would rather not admit they need them. Bring back food and metal and you will not go hungry.', opts: [act('Let\'s trade.', 'trade'), bye()] },
  } },
  t_wright: { name: 'Tomaz Brill', role: 'Shipwright', col: 0x5a5f66, n: {
    start: { text: 'An old Imperial light hauler. Good bones, tired everything else. I can rewind the hyperdrive coils, tune the thrusters, or knock out a bulkhead for more hold space — if you have the credits.', opts: [act('What can you fit?', 'upgrades'), o('How far will she jump as she is?', 'range'), bye()] },
    range: { text: 'Five thousand parsecs on stock coils, give or take. Enough to hop inward a system at a time. Trantor? That is a long chain of jumps — Santanni, Vega, and whatever lies between. Better coils shorten the chain.', opts: [act('Show me the upgrades.', 'upgrades'), bye()] },
  } },
  t_archivist: { name: 'Lirel Hanno', role: 'Archivist, Encyclopedia Hall', col: 0x6a4c7a, n: {
    start: { text: 'Please keep your voice down. Forty people on this floor are summarising the metallurgy of the Sirius Sector, and none of them is in a forgiving mood.', opts: [o('What is the Encyclopedia?', 'what'), o('Why build it out here?', 'why'), act('Do you need a courier?', 'jobs'), bye('Sorry. Good day.')] },
    what: { text: 'Everything. The whole of human knowledge, gathered and set down in one work before any more of it is mislaid. Volume One goes to press within a few years. My section alone has consumed three lifetimes — two of them not mine.', opts: [o('Why build it out here?', 'why'), bye('Impressive.')] },
    why: { text: 'The charter placed us where we could work undisturbed, far from the distractions of the centre. Dr. Seldon chose the site himself, so the founders said. Fifty years on, I think we have been undisturbed quite enough, but nobody asks an archivist.', opts: [o('Fifty years?', 'fifty'), bye()] },
    fifty: { text: 'Nearly. There is to be an anniversary. The Vault beside the Hall is supposed to open for it — a recorded address from the founder, or so the Board assumes. I expect it will be about deadlines.', opts: [bye('Thank you.')] },
  } },
  t_astro: { name: 'Pell Aravid', role: 'Astronomer, Rim Observatory', col: 0x2f6b6b, n: {
    start: { text: 'Look up after dark some time. On one side of the sky, the whole Galaxy, like a lens of mist. On the other side — nothing at all. We are the last lamp on the road.', opts: [act('Do you need anything surveyed?', 'jobs'), o('What is out there, past the rim?', 'past'), bye()] },
    past: { text: 'Intergalactic dark. But rimward and inward there are charted systems nobody has looked at properly in a century. The old Imperial surveys are full of entries that say "to be confirmed". I pay for confirmations.', opts: [act('I will take a survey job.', 'jobs'), bye()] },
  } },
  t_engineer: { name: 'Sath Korwin', role: 'Engineer, Municipal Power Station', col: 0x7a6a2a, n: {
    start: { text: 'Mind the yellow line. She is a small reactor, but a good one — we have had to learn to build small, with no metal to waste.', opts: [o('Does everyone out here use atomic power?', 'atomic'), bye()] },
    atomic: { text: 'They should. A hauler told me the plants on Anacreon are going cold one by one, for want of anyone who can read the manuals. I told him that was absurd. I am still hoping it is absurd.', opts: [bye('Let us hope.')] },
  } },
  t_barkeep: { name: 'Mara Quill', role: 'Keeper of the Rim Light', col: 0x7a2f3a, n: {
    start: { text: 'Sit anywhere. What will it be — local beer, or the news?', opts: [o('The news.', 'news'), o('Who drinks here?', 'who'), bye('Just looking.')] },
    news: { text: 'An envoy from Anacreon is expected, all braid and boots, to discuss "mutual protection". The Board says the Emperor will sort it out. The Mayor\'s friends at the Journal say the Emperor could not find Terminus on a chart. Take your pick.', opts: [o('And what do you say?', 'say'), bye()] },
    say: { text: 'I say scholars make poor soldiers and worse customers. But they pay on time. Another?', opts: [bye('Not today.')] },
    who: { text: 'Dockhands, a few traders, the odd clerk hiding from the Encyclopedia. The scholars keep to the hill. Fifty years here and half of them still talk as if they were visiting.', opts: [bye()] },
  } },
  t_clerk: { name: 'Jonn Tevis', role: 'Clerk, City Hall', col: 0x4a5a4a, n: {
    start: { text: 'City Hall. If it concerns the Encyclopedia, you want the Board of Trustees. If it concerns anything else, you will find the Board decides that too.', opts: [o('Then what does the Mayor do?', 'mayor'), bye()] },
    mayor: { text: 'Street lighting, drains, and the spaceport dues. Mayor Hardin has opinions on a good deal more than drains, mind you, and a million people who were born here and never wrote a line of any encyclopedia tend to listen.', opts: [bye('Interesting.')] },
  } },
  t_spacer: { name: 'Old Kessa', role: 'Retired tramp pilot', col: 0x555555, n: {
    start: { text: 'New in the lanes? Three things. Keep clear of a planet\'s mass before you charge the drive. Line your nose up on the star before you jump. And never tell an Anacreonian officer his ship is older than he is.', opts: [o('How do I reach Trantor?', 'trantor'), o('Any worlds worth seeing?', 'see'), bye('I\'ll remember.')] },
    trantor: { text: 'In hops. Santanni first, then Vega, then find a waystation toward the core — Hesperos Reach will do. Each jump only what your coils will bear. The chart in your cabin shows the range ring.', opts: [bye('Thanks.')] },
    see: { text: 'All of them, once. The little ones nobody put in a book are the ones you remember. Survey money is decent, too — ask the astronomer on the east side.', opts: [bye()] },
  } },
  t_farmer: { name: 'Hob Tessel', role: 'Grower', col: 0x4f6b3a, n: {
    start: { text: 'Roots and greens, grown under glass. Soil out here is thin and the season is short. The scholars eat like birds anyway.', opts: [bye('Good luck with the harvest.')] },
  } },

  // ANACREON
  a_port: { name: 'Captain Verl haut Kasso', role: 'Port Captain, Royal Port of Anacreon', col: 0x7a1f1f, n: {
    start: { text: 'State your cargo and your business. This is the Royal Port of Anacreon. Not the Prefect\'s port, not the Emperor\'s. His Majesty\'s.', opts: [o('A trader, looking for work.', 'work'), o('Those are impressive cruisers.', 'ships'), bye('Only passing through.')] },
    work: { text: 'Traders are tolerated. The board in my office lists what the realm wants carried. Carry it honestly and you will be paid. Carry it otherwise and you will meet the garrison.', opts: [act('Show me the board.', 'jobs'), bye()] },
    ships: { text: 'Imperial heavy cruisers, inherited with the Prefecture. Finest hulls in the Periphery.', opts: [o('When did they last fly?', 'fly'), bye('Magnificent.')] },
    fly: { text: '…That is a naval matter. Move along, spacer.', opts: [bye('Of course, Captain.')] },
  } },
  a_trader: { name: 'Ilsa Tharn', role: 'Bazaar merchant', col: 0xa0662a, n: {
    start: { text: 'Grain, cloth, hides — Anacreon feeds itself and has plenty over. Machine parts, now, or a working instrument? Name your price. Nobody here makes them any more.', opts: [act('Let us trade.', 'trade'), o('Nobody makes them?', 'nobody'), bye()] },
    nobody: { text: 'The Imperial technicians went home when the Viceroy became a King, or grew old, or took their secrets to the grave. The nobles say it does not matter. The nobles do not have to keep a grain elevator running.', opts: [act('Show me your goods.', 'trade'), bye()] },
  } },
  a_wright: { name: 'Garn Odrik', role: 'Master of the Royal Yards', col: 0x4a4a52, n: {
    start: { text: 'Small craft I can still service. Yours is simple enough — honest Imperial work, built before they forgot how. What do you need?', opts: [act('What can you fit?', 'upgrades'), bye()] },
  } },
  a_steward: { name: 'Pellam haut Corvane', role: 'Under-Steward of the Royal Household', col: 0x8a7a2a, n: {
    start: { text: 'His Majesty does not receive spacers. I, however, receive deliveries. The household has needs that Anacreon cannot presently supply.', opts: [act('What needs carrying?', 'jobs'), o('This was the Viceroy\'s palace?', 'palace'), bye()] },
    palace: { text: 'It was the residence of the Emperor\'s Prefect. It is the palace of the King of Anacreon. The same man, the same chair — a different hat. The Empire was informed. The Empire did not reply.', opts: [bye('I see.')] },
  } },
  a_engineer: { name: 'Vessin Dray', role: 'Former Imperial technician', col: 0x5f6a70, n: {
    start: { text: 'Third technician, Prefectural Power Station Four. That is it behind the seals. I can tell you which valve sticks. I cannot tell you why any of it works. The man who could died nineteen years ago.', opts: [o('What powers the city now?', 'now'), bye('I am sorry.')] },
    now: { text: 'Coal. Oil. You can smell it from the east quarter. We had the atom and we have gone back to setting fire to things. They say a place on the rim still trains real engineers — some colony of book-writers. I would give a great deal to see their manuals.', opts: [bye('Perhaps you will.')] },
  } },
  a_inn: { name: 'Bruna Hale', role: 'Keeper of the Nyak & Lance', col: 0x6a3a2a, n: {
    start: { text: 'Ale, a bed, and no questions about your papers. What else does a spacer want?', opts: [o('Talk of the town?', 'talk'), bye('Nothing just now.')] },
    talk: { text: 'Smyrno is rattling sabres on the border again. The young lords talk of nothing but the Nyak hunt. And there is word the Crown has its eye on that little scholar-world at the rim. Easy pickings, they say. They said that about Smyrno, too.', opts: [bye('Thank you.')] },
  } },
  a_soldier: { name: 'Sergeant Odo Brask', role: 'Royal Guard', col: 0x7a1f1f, n: {
    start: { text: 'Gate is open till dusk. Keep your hands where I can see them and your ship where the Port Captain put it.', opts: [bye('Yes, Sergeant.')] },
  } },
  a_farmer: { name: 'Wenna Sool', role: 'Tenant farmer', col: 0x5a6b3a, n: {
    start: { text: 'First it was the Emperor\'s tax, now it is the King\'s. Grain weighs the same on either scale. Are you buying?', opts: [bye('Not today.')] },
  } },

  // TRANTOR
  r_entry: { name: 'Evard Simm', role: 'Entry Clerk, Third Class', col: 0x3a4a6a, n: {
    start: { text: 'Welcome to Trantor. Ship of registry, port of origin, purpose of visit, and Form 7-Transit in triplicate. Do not obstruct the walkway.', opts: [o('I came in from Terminus.', 'terminus'), o('Where does one go from here?', 'where'), bye('Thank you.')] },
    terminus: { text: 'Ter-mi-nus. One moment. … It is listed. Anacreon Province, outer Periphery. I have never processed anyone from there. You will need Form 7-Transit-Supplementary. I do not have one. Proceed.', opts: [o('Where does one go from here?', 'where'), bye()] },
    where: { text: 'Lift One descends to the Concourse — commerce, bureaux, and connections to the sector ways. Lift Two rises to the Observation Tower, for those who wish to see the sky. Most residents do not.', opts: [bye('Much obliged.')] },
  } },
  r_trader: { name: 'Oriane Deshk', role: 'Licensed factor, Agricultural Imports Concession', col: 0x8a6a3a, n: {
    start: { text: 'Twenty worlds farm so that this one may file papers. Forty billion mouths and not one field. If you have food in your hold, I am your friend for life.', opts: [act('Let us trade.', 'trade'), o('What does Trantor export?', 'export'), bye()] },
    export: { text: 'Decisions. Also luxuries, book-films, and fashions that will reach the provinces in ten years. Take luxuries outward — the further from here, the more they will pay to feel close to it.', opts: [act('Show me prices.', 'trade'), bye()] },
  } },
  r_wright: { name: 'Halvard Imm', role: 'Agent, Imperial Dockyard Services', col: 0x50565e, n: {
    start: { text: 'Dockyard Services. We can refit a vessel of your class within the hour. Payment precedes work. That is not rudeness; it is regulation.', opts: [act('What can you fit?', 'upgrades'), bye()] },
  } },
  r_bureau: { name: 'Sennet Ko', role: 'Dispatch Officer, Bureau of Provincial Correspondence', col: 0x4a3a6a, n: {
    start: { text: 'Every province must receive its directives, and the courier service is — let us say — oversubscribed. Private carriers are engaged under Schedule Nine. Are you a private carrier?', opts: [act('I am. What needs carrying?', 'jobs'), o('Do the provinces answer?', 'answer'), bye()] },
    answer: { text: 'The inner ones, promptly. The outer ones, eventually. Some of the outermost have not acknowledged a directive in years. We continue to send them. The file would be incomplete otherwise.', opts: [act('I will carry one.', 'jobs'), bye()] },
  } },
  r_library: { name: 'Thessaly Varn', role: 'Reading-room attendant, Library annex', col: 0x6a5a3a, n: {
    start: { text: 'The Imperial Library proper is in the University district, a morning\'s ride by sector way. This annex holds only the common indices. Only eleven million titles.', opts: [o('Who studies here?', 'who'), bye()] },
    who: { text: 'Fewer each year. Scholars now prefer to compare what earlier scholars wrote. It is cleaner than finding anything out. I do not complain; the reading rooms are very quiet.', opts: [bye('Thank you.')] },
  } },
  r_tourist: { name: 'Doran Vell', role: 'Visitor from the provinces', col: 0x2a6a5a, n: {
    start: { text: 'I saved six years for the passage. Look at it! Metal to the horizon in every direction. You cannot see the ground. There is no ground. My cousin said I would be disappointed.', opts: [o('And are you?', 'are'), bye('Enjoy the view.')] },
    are: { text: 'No. Well. I had imagined it shinier. Half the towers on that side have dark floors, do you see? A porter told me they have been "awaiting maintenance" since before he was born.', opts: [bye()] },
  } },
  r_foreman: { name: 'Brakka Tol', role: 'Maintenance foreman, Sector ventilation', col: 0x6a5a2a, n: {
    start: { text: 'Third ventilator failure this month on this level alone. I put in for parts in the spring. The requisition is "under review". Everything on Trantor is under review.', opts: [o('Does it always take so long?', 'long'), bye('Good luck.')] },
    long: { text: 'It did not, in my grandfather\'s day. He used to say the planet ran like a watch. Now it runs like a committee. Still runs, mind. Forty billion people will tell you it always will.', opts: [bye()] },
  } },
  r_guide: { name: 'Pim Arrosa', role: 'Unlicensed guide', col: 0x8a3a5a, n: {
    start: { text: 'First time on Trantor? I can always tell — you keep looking up. Nobody born here looks up. The Imperial Palace? A hundred square miles of real soil and real trees, and no, they will not let you in.', opts: [o('What can a visitor see?', 'see'), bye()] },
    see: { text: 'The Tower, for the sky. The Concourse, for the crowds. And the queues. People forget the queues, but they are the truest thing here.', opts: [bye('Thanks, Pim.')] },
  } },

  // generic outposts
  g_factor: { name: 'Port Factor', role: 'Landing field office', col: 0x5a5a4a, n: {
    start: { text: 'Not many ships put down here these days. Fuel is dear, news is free, and I buy and sell whatever fits in a hold.', opts: [act('Let us trade.', 'trade'), act('Any work going?', 'jobs'), o('Any news?', 'news'), bye()] },
    news: { text: 'The tax ship is late again. Some say it is not coming. I keep the ledger up all the same — somebody will want it, some day.', opts: [bye()] },
  } },
  g_local: { name: 'Settler', role: 'Local', col: 0x6b5a3a, n: {
    start: { text: 'From off-world? Then you have seen more than I ever will. Is it true Trantor has no sky?', opts: [o('It has one. Few people look at it.', 'a'), bye('So they say.')] },
    a: { text: 'Hm. I would look at it. I look at this one every night.', opts: [bye()] },
  } },
};
