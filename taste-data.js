// EASY TO EDIT: add or remove names inside the quotes. Keep each name unique across genres.

const GENRES = {
  'Pop': ['Taylor Swift', 'Ariana Grande', 'Dua Lipa', 'Billie Eilish', 'Olivia Rodrigo', 'The Weeknd', 'Harry Styles', 'Ed Sheeran', 'Justin Bieber', 'Selena Gomez', 'Sabrina Carpenter', 'Chappell Roan', 'Lady Gaga', 'Katy Perry', 'Bruno Mars', 'Shawn Mendes', 'Charlie Puth', 'Miley Cyrus', 'Rihanna', 'Beyoncé', 'Doja Cat', 'Lizzo', 'Sia', 'Camila Cabello', 'Demi Lovato', 'Troye Sivan', 'Benson Boone', 'Tate McRae', 'Gracie Abrams', 'Lewis Capaldi', 'Adele', 'Sam Smith', 'Maroon 5', 'One Direction', 'Jonas Brothers', 'Conan Gray', 'Lauv', 'Halsey', 'Madison Beer', 'Zara Larsson', 'Shakira', 'Ava Max', 'Meghan Trainor', 'Jessie J', 'Ellie Goulding', 'Coldplay'],
  'Hip-Hop': ['Drake', 'Kendrick Lamar', 'Travis Scott', 'Kanye West', 'Eminem', 'J. Cole', 'Post Malone', 'Lil Wayne', 'Jay-Z', 'Nicki Minaj', 'Cardi B', 'Megan Thee Stallion', '21 Savage', 'Future', 'Lil Baby', 'Juice WRLD', 'XXXTentacion', 'Lil Uzi Vert', 'Playboi Carti', 'A$AP Rocky', 'Tyler, The Creator', 'Mac Miller', 'Kid Cudi', '50 Cent', 'Snoop Dogg', 'Dr. Dre', '2Pac', 'The Notorious B.I.G.', 'Nas', 'Childish Gambino', 'Metro Boomin', 'Don Toliver', 'Doechii', 'Ice Spice', 'Lil Nas X', 'Logic', 'Pop Smoke', 'Polo G', 'Roddy Ricch', 'DaBaby', 'Gunna', 'Young Thug', 'Migos', 'Offset', 'Ice Cube', 'Lil Durk', 'Central Cee', 'Stormzy'],
  'R&B & Soul': ['SZA', 'Frank Ocean', 'Usher', 'Chris Brown', 'Bryson Tiller', 'Summer Walker', 'Daniel Caesar', 'H.E.R.', 'Jhené Aiko', 'Brent Faiyaz', 'Alicia Keys', 'Khalid', 'Giveon', 'Miguel', 'Ne-Yo', 'John Legend', 'Anderson .Paak', 'Steve Lacy', 'Victoria Monét', 'Kehlani', 'Tinashe', 'Mary J. Blige', 'Whitney Houston', 'Stevie Wonder', 'Michael Jackson', 'Marvin Gaye', 'Amy Winehouse', 'Lauryn Hill', 'Aaliyah', 'Destiny\'s Child', 'Ella Mai', 'Tems', 'Burna Boy', 'Wizkid'],
  'Rock': ['Queen', 'The Beatles', 'Led Zeppelin', 'Pink Floyd', 'AC/DC', 'Guns N\' Roses', 'Nirvana', 'Foo Fighters', 'Red Hot Chili Peppers', 'Green Day', 'Linkin Park', 'U2', 'The Rolling Stones', 'Eagles', 'Aerosmith', 'Bon Jovi', 'Fleetwood Mac', 'Pearl Jam', 'The Doors', 'Jimi Hendrix', 'Oasis', 'Blink-182', 'Paramore', 'Fall Out Boy', 'My Chemical Romance', 'Twenty One Pilots', 'The Killers', 'Muse', 'Måneskin', 'Kings of Leon', 'Imagine Dragons', 'OneRepublic', 'Bob Dylan', 'David Bowie', 'Dire Straits', 'Deep Purple', 'Scorpions', 'Creedence Clearwater Revival', 'Billy Joel', 'Elton John'],
  'Alternative & Indie': ['Arctic Monkeys', 'Tame Impala', 'The 1975', 'Glass Animals', 'Mac DeMarco', 'Beach House', 'Cigarettes After Sex', 'The Neighbourhood', 'Lana Del Rey', 'Mitski', 'Phoebe Bridgers', 'Clairo', 'Florence + The Machine', 'Vampire Weekend', 'The Strokes', 'Radiohead', 'Bon Iver', 'Lorde', 'Hozier', 'Mumford & Sons', 'Gorillaz', 'MGMT', 'Arcade Fire', 'Bleachers', 'beabadoobee', 'Wallows', 'Joji', 'LANY', 'Rex Orange County', 'Peach Pit', 'Men I Trust', 'Noah Kahan', 'The Cure', 'Joy Division', 'The Smiths', 'Death Cab for Cutie', 'Cage the Elephant', 'Billie Marten'],
  'Metal': ['Metallica', 'Iron Maiden', 'Black Sabbath', 'Slipknot', 'System of a Down', 'Megadeth', 'Pantera', 'Avenged Sevenfold', 'Bring Me the Horizon', 'Rammstein', 'Disturbed', 'Korn', 'Slayer', 'Judas Priest', 'Ozzy Osbourne', 'Motörhead', 'Sleep Token', 'Gojira', 'Bullet for My Valentine', 'Evanescence', 'Limp Bizkit', 'Mastodon', 'Opeth', 'Sabaton', 'Rage Against the Machine', 'Five Finger Death Punch', 'Trivium', 'Lamb of God', 'Ghost', 'Parkway Drive'],
  'EDM & Dance': ['Calvin Harris', 'David Guetta', 'Martin Garrix', 'Marshmello', 'The Chainsmokers', 'Avicii', 'Skrillex', 'Diplo', 'Tiësto', 'Zedd', 'Alan Walker', 'Kygo', 'Daft Punk', 'Swedish House Mafia', 'Illenium', 'deadmau5', 'Armin van Buuren', 'Steve Aoki', 'Major Lazer', 'Fred again..', 'Peggy Gou', 'Disclosure', 'Fisher', 'Eric Prydz', 'Afrojack', 'Hardwell', 'Porter Robinson', 'ODESZA', 'Flume', 'Alesso', 'RÜFÜS DU SOL', 'Anyma', 'Martin Solveig', 'Nicky Romero', 'Kaskade'],
  'Country': ['Morgan Wallen', 'Luke Combs', 'Zach Bryan', 'Chris Stapleton', 'Carrie Underwood', 'Johnny Cash', 'Dolly Parton', 'Kacey Musgraves', 'Luke Bryan', 'Jason Aldean', 'Blake Shelton', 'Shania Twain', 'Kenny Rogers', 'Willie Nelson', 'John Denver', 'Tyler Childers', 'Lainey Wilson', 'Kane Brown', 'Thomas Rhett', 'Miranda Lambert', 'Brad Paisley', 'Florida Georgia Line', 'Keith Urban', 'Eric Church', 'Jelly Roll', 'Hardy', 'Chris Young', 'Dan + Shay'],
  'Latin': ['Bad Bunny', 'J Balvin', 'Daddy Yankee', 'Karol G', 'Ozuna', 'Maluma', 'Rosalía', 'Luis Fonsi', 'Anuel AA', 'Peso Pluma', 'Feid', 'Rauw Alejandro', 'Becky G', 'Enrique Iglesias', 'Ricky Martin', 'Camilo', 'Myke Towers', 'Sebastián Yatra', 'Nicky Jam', 'Jennifer Lopez', 'Selena', 'Carlos Santana', 'Gloria Estefan', 'Manuel Turizo'],
  'K-Pop': ['BTS', 'BLACKPINK', 'Stray Kids', 'NewJeans', 'TWICE', 'SEVENTEEN', 'EXO', 'ENHYPEN', 'aespa', 'LE SSERAFIM', 'ITZY', 'TXT', 'Jungkook', 'Jimin', 'V', 'Rosé', 'Lisa', 'Jennie', 'Jisoo', 'IVE', 'ATEEZ', 'GOT7', 'Red Velvet', '(G)I-DLE', 'PSY', 'NCT', 'SHINee', 'Big Bang', 'Suga', 'RM', 'J-Hope', 'Jin'],
  'Bollywood': ['Arijit Singh', 'A. R. Rahman', 'Atif Aslam', 'Shreya Ghoshal', 'Sonu Nigam', 'Neha Kakkar', 'Badshah', 'Jubin Nautiyal', 'Darshan Raval', 'Armaan Malik', 'Kishore Kumar', 'Lata Mangeshkar', 'Mohit Chauhan', 'KK', 'Pritam', 'Vishal Mishra', 'Sunidhi Chauhan', 'Tulsi Kumar', 'Shankar Mahadevan', 'Asees Kaur', 'Anuv Jain', 'Prateek Kuhad', 'Mohammed Rafi', 'Udit Narayan', 'Kumar Sanu', 'Alka Yagnik', 'Rahat Fateh Ali Khan', 'Amit Trivedi'],
  'Punjabi & Desi Hip-Hop': ['Diljit Dosanjh', 'Sidhu Moose Wala', 'AP Dhillon', 'Karan Aujla', 'Yo Yo Honey Singh', 'Divine', 'Emiway Bantai', 'King', 'Raftaar', 'Seedhe Maut', 'KR$NA', 'Hanumankind', 'Shubh', 'Guru Randhawa', 'Talwiinder', 'Naezy', 'MC Stan', 'Ikka', 'Bohemia', 'Sharry Maan', 'B Praak', 'Jassie Gill', 'Harrdy Sandhu', 'Sunanda Sharma']
};

// Games and their rank ladders. Use null when a game has no ranks (the rank screen is skipped).
const casual = (list) => ['Just casual'].concat(list);
const GAMES = {
  'Valorant': casual(['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant']),
  'CS2': casual(['Silver', 'Gold Nova', 'Master Guardian', 'Legendary Eagle', 'Supreme Master', 'Global Elite']),
  'BGMI': casual(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crown', 'Ace', 'Ace Master', 'Ace Dominator', 'Conqueror']),
  'Call of Duty: Mobile': casual(['Rookie', 'Veteran', 'Elite', 'Pro', 'Master', 'Grandmaster', 'Legendary']),
  'League of Legends': casual(['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger']),
  'Dota 2': casual(['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']),
  'Fortnite': casual(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Elite', 'Champion', 'Unreal']),
  'Apex Legends': casual(['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Predator']),
  'Overwatch 2': casual(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Champion']),
  'Rainbow Six Siege': casual(['Copper', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Champion']),
  'EA FC': casual(['Division 10 to 6', 'Division 5 to 3', 'Division 2 to 1', 'Elite Division', 'FUT Champions']),
  'Chess': ['Just started', 'Under 800', '800 to 1200', '1200 to 1600', '1600+'],
  'Clash Royale': casual(['Arena 1 to 10', 'Arena 11 to 15', 'Champion', 'Grand Champion', 'Ultimate Champion']),
  'Minecraft': null,
  'GTA V': null,
  'Roblox': null,
  'Genshin Impact': null,
  'Among Us': null
};

const SPORTS = ['Cricket', 'Football', 'Basketball', 'Badminton', 'Tennis', 'Table Tennis', 'Volleyball', 'Kabaddi', 'Swimming', 'Running', 'Gym / Fitness', 'Cycling', 'Trekking / Hiking', 'Skateboarding', 'Boxing / MMA', 'Formula 1', 'Yoga', 'Skating'];

const BIKES = ['Royal Enfield Classic 350', 'Royal Enfield Himalayan', 'Royal Enfield Hunter 350', 'Royal Enfield Bullet', 'KTM Duke', 'KTM RC', 'Yamaha R15', 'Yamaha MT-15', 'Bajaj Pulsar', 'Bajaj Dominar', 'TVS Apache', 'Honda CB350', 'Kawasaki Ninja', 'Triumph', 'Harley-Davidson', 'Ducati', 'BMW GS', 'Suzuki Hayabusa', 'Jawa / Yezdi', 'Scooter'];
