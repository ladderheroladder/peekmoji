// Each entry: "<emoji> <main name>,<alias>,<alias>" separated by ";"
// The first name is what's shown; aliases are also accepted as correct guesses.
// Puzzles are picked from a date-seeded shuffle of each list, so adding/removing entries reshuffles
// that category's schedule (including today's). Best to finalize lists before launch.
window.PEEKMOJI_CATS = [
  { id: 'animals', label: 'Animals', icon: '🐾', list:
    '🐶 dog,puppy;🐱 cat,kitten;🐭 mouse,rat;🐹 hamster;🐰 rabbit,bunny;🦊 fox;🐻 bear;🐼 panda;🐨 koala;🐯 tiger;' +
    '🦁 lion;🐮 cow;🐷 pig;🐸 frog;🐵 monkey;🐔 chicken,hen;🐧 penguin;🦆 duck;🦅 eagle;🦉 owl;' +
    '🦇 bat;🐺 wolf;🐴 horse;🦄 unicorn;🐝 bee,honeybee;🦋 butterfly;🐌 snail;🐞 ladybug,ladybird;🐢 turtle,tortoise;🐍 snake;' +
    '🦖 t-rex,dinosaur,trex;🐙 octopus;🦀 crab;🐡 pufferfish,blowfish;🐬 dolphin;🐳 whale;🦈 shark;🐊 crocodile,alligator,croc;🦓 zebra;🦒 giraffe;' +
    '🐘 elephant;🦏 rhino,rhinoceros;🦛 hippo,hippopotamus;🐪 camel;🦘 kangaroo;🦩 flamingo;🦚 peacock;🦜 parrot;🦥 sloth;🦔 hedgehog;' +
    '🐿️ chipmunk,squirrel;🦦 otter;🐓 rooster;🦃 turkey;🐑 sheep,lamb'
  },
  { id: 'food', label: 'Food', icon: '🍕', list:
    '🍎 apple;🍐 pear;🍊 orange,tangerine;🍋 lemon;🍌 banana;🍉 watermelon;🍇 grapes,grape;🍓 strawberry;🍒 cherries,cherry;🍑 peach;' +
    '🥭 mango;🍍 pineapple;🥥 coconut;🥝 kiwi;🍅 tomato;🍆 eggplant,aubergine;🥑 avocado;🥦 broccoli;🥕 carrot;🌽 corn,maize;' +
    '🌶️ chili pepper,chili,chilli,hot pepper;🥒 cucumber,pickle;🍄 mushroom;🥜 peanuts,peanut;🍞 bread,loaf;🥐 croissant;🥖 baguette;🥨 pretzel;🧀 cheese;🥚 egg;' +
    '🍳 fried egg,frying pan,cooking;🥞 pancakes,pancake;🥓 bacon;🍗 chicken leg,drumstick;🍔 burger,hamburger,cheeseburger;🍟 fries,french fries,chips;🍕 pizza;🌭 hot dog,hotdog;🥪 sandwich;🌮 taco;' +
    '🌯 burrito,wrap;🍝 spaghetti,pasta;🍜 ramen,noodles;🍣 sushi;🍤 shrimp,prawn,tempura;🍙 rice ball,onigiri;🥟 dumpling;🍩 donut,doughnut;🍪 cookie,biscuit;🎂 cake,birthday cake;' +
    '🧁 cupcake,muffin;🍦 ice cream,soft serve;🍫 chocolate,chocolate bar;🍭 lollipop;🍿 popcorn;🍯 honey;🥛 milk;☕ coffee,tea;🧃 juice box,juice'
  },
  { id: 'objects', label: 'Objects', icon: '💡', list:
    '⌚ watch;📱 phone,smartphone,mobile,cellphone;💻 laptop,computer;📷 camera;📺 television,tv;📻 radio;⏰ alarm clock,clock;🔦 flashlight,torch;💡 light bulb,lightbulb,bulb;🕯️ candle;' +
    '🔑 key;🔨 hammer;🪓 axe;🔧 wrench,spanner;⚙️ gear,cog;🧲 magnet;🧭 compass;🔭 telescope;🔬 microscope;💊 pill,medicine,capsule;' +
    '🧸 teddy bear,teddy;🎈 balloon;🎁 gift,present;📦 box,package,parcel;✉️ envelope,letter,mail;📚 books,book;✏️ pencil;✂️ scissors;📎 paperclip,paper clip;🔒 lock,padlock;' +
    '🛒 shopping cart,cart,trolley;🪑 chair;🚽 toilet;🛁 bathtub,bath;🧻 toilet paper,toilet roll;🧽 sponge;🧹 broom;👓 glasses,eyeglasses,spectacles;🕶️ sunglasses;👑 crown;' +
    '💍 ring;👟 sneaker,shoe,trainer;🎩 top hat,hat;🧢 cap,baseball cap;🎒 backpack,bag,school bag;☂️ umbrella;💎 diamond,gem;🎸 guitar;🥁 drum,drums;🎺 trumpet;' +
    '🎻 violin,fiddle;🎹 piano,keys'
  },
  { id: 'nature', label: 'Nature', icon: '🌿', list:
    '🌵 cactus;🎄 christmas tree;🌲 pine tree,evergreen,fir;🌳 tree,oak;🌴 palm tree,palm;🌱 seedling,sprout;🍀 four leaf clover,clover,shamrock;🍁 maple leaf,leaf;🍂 fallen leaves,autumn leaves;🌷 tulip;' +
    '🌹 rose;🌻 sunflower;🌼 daisy,blossom;🌸 cherry blossom,sakura;🌺 hibiscus;💐 bouquet,flowers;🌾 wheat,rice,grain;☀️ sun;🌙 moon,crescent moon;⭐ star;' +
    '🌈 rainbow;☁️ cloud;⛈️ thunderstorm,storm;❄️ snowflake,snow;⛄ snowman;🔥 fire,flame;💧 water drop,droplet,drop;🌊 wave,ocean;🌋 volcano;🏔️ mountain,snowy mountain;' +
    '🌍 earth,globe,world,planet;🪐 saturn,ringed planet;☄️ comet,meteor;⚡ lightning,zap,bolt;🌪️ tornado,twister;🍃 leaves,wind;🐚 seashell,shell;🏝️ island,desert island;🏜️ desert;🌅 sunrise,sunset'
  },
  { id: 'fun', label: 'Sports & Fun', icon: '⚽', list:
    '⚽ soccer ball,soccer,football;🏀 basketball;🏈 american football,football;⚾ baseball;🥎 softball;🎾 tennis ball,tennis;🏐 volleyball;🏉 rugby ball,rugby;🎱 pool ball,8 ball,eight ball,billiards,pool;🏓 ping pong,table tennis;' +
    '🏸 badminton,shuttlecock;🥊 boxing glove,boxing;🥋 karate,martial arts,judo;⛳ golf,flag in hole;⛸️ ice skate,skate,skating;🎣 fishing,fishing rod,fishing pole;🎿 skis,ski,skiing;🛷 sled,sledge;🥌 curling stone,curling;🎯 dart,darts,bullseye,target;' +
    '🪁 kite;🎮 video game,controller,game controller,gamepad;🕹️ joystick;🎲 dice,die;🧩 puzzle piece,puzzle,jigsaw;♟️ chess,pawn,chess pawn;🃏 joker,playing card,card;🎳 bowling;🏆 trophy,cup;🥇 gold medal,medal;' +
    '🛹 skateboard;🎨 palette,art,paint,painting;🎭 theater masks,masks,drama,theatre;🎤 microphone,mic,karaoke;🎧 headphones;🎬 clapperboard,movie,film;🎪 circus tent,circus;🎡 ferris wheel;🎢 roller coaster,rollercoaster;🎠 carousel,merry go round'
  },
  { id: 'travel', label: 'Travel', icon: '✈️', list:
    '🚗 car;🚕 taxi,cab;🚌 bus;🚓 police car,police;🚑 ambulance;🚒 fire truck,fire engine;🚜 tractor;🏎️ race car,racecar,formula 1;🏍️ motorcycle,motorbike;🚲 bicycle,bike;' +
    '🛴 scooter,kick scooter;🚂 train,steam train,locomotive;🚁 helicopter;✈️ airplane,plane,aeroplane;🚀 rocket,spaceship;🛸 ufo,flying saucer;⛵ sailboat,boat,sailing;🚢 ship,cruise ship;⚓ anchor;🗽 statue of liberty;' +
    '🗼 tokyo tower,tower;🏰 castle;⛺ tent,camping;🏠 house,home;🏥 hospital;⛽ gas pump,fuel pump,petrol pump,gas station;🚦 traffic light,stoplight;🗿 moai,easter island head,statue;🗺️ map,world map;🧳 suitcase,luggage;' +
    '⛲ fountain;🌉 bridge;🎫 ticket;🚏 bus stop;🛶 canoe,kayak;🏖️ beach,umbrella beach;🗻 mount fuji,fuji;🚤 speedboat,motorboat;🚠 cable car,gondola;🛺 tuk tuk,auto rickshaw'
  }
];
