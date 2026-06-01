# Prezentacia projektu OverBound

## Slide 1: Nazov projektu

# OverBound

OverBound je 2D platformova hra v prehliadaci, vytvorena ako sucast Angular aplikacie.

Spaja klasicku side-scrolling hratelnost s pouzivatelskymi uctami, postupom v hre, odmenami v podobe zlata, obchodom, profilmi hracov, tradingom, leaderboardom a komunitnym forom.

---

## Slide 2: Co je OverBound?

OverBound je pixelova platformova hra, v ktorej sa hrac pohybuje cez miestnosti a levely, vyhyba sa nebezpecenstvu, bojuje s nepriatelmi, ziskava odmeny za postup a prechadza cez portaly.

Hra nie je iba samostatna canvas hra. Je vlozena do plnohodnotnej webovej aplikacie s prihlasovanim, upravou uctu, inventarom, socialnymi funkciami a ukladanim dat cez Firebase.

---

## Slide 3: Hlavny ciel projektu

Cielom projektu OverBound je vytvorit interaktivnu webovu hru s kompletnym ekosystemom pre hraca.

Hrac moze:

- Spustit a hrat 2D platformovu hru.
- Pohybovat sa, skakat, crouchovat, dashovat, utocit a rozpravat sa s NPC postavami.
- Postupovat cez viacero miestnosti a levelov pomocou portalov.
- Porazat nepriatelov a ziskavat zlato.
- Prisposobit si ucet a postavu.
- Kupovat predmety v obchode.
- Vymienat predmety s inymi hracmi.
- Pridavat prispevky a odpovedat v komunitnom fore.
- Sutazit v leaderboarde.

---

## Slide 4: Gameplay funkcie

OverBound obsahuje zakladne mechaniky platformovej hry:

- Pohyb pomocou klavesnice.
- Skakanie a super jump.
- Crouchovanie.
- Dashovanie.
- Utocenie na nepriatelov.
- Zdravie nepriatelov a logiku ich porazenia.
- Zdravie hraca a stav smrti.
- Detekciu kolizii pomocou koliznych map levelov.
- Kameru, ktora sleduje hraca.
- Portaly na prechod medzi levelmi.
- Animovane sprity pre hraca, NPC, nepriatelov, portaly a UI.

---

## Slide 5: Ovladanie

Predvolene ovladanie:

- `A`: Pohyb dolava.
- `D`: Pohyb doprava.
- `W` alebo `Space`: Skok.
- `S`: Crouch.
- `S + skok`: Super jump.
- `O`: Dash.
- `I`: Utok.
- `E`: Rozhovor s NPC.
- `Escape`: Pauza alebo zatvorenie NPC chatu.

Projekt obsahuje aj moznost prisposobit klavesove skratky v nastaveniach.

---

## Slide 6: Levely a dizajn sveta

Hra pouziva samostatne level data a graficke assety pre viacero oblasti.

Level system obsahuje:

- Kolizne mapy.
- Obrazky pozadia.
- Foreground sprity.
- Spawn pozicie hraca.
- Umiestnenie nepriatelov.
- Umiestnenie NPC.
- Pozicie portalov.
- Prechody medzi levelmi.

Aktualny projekt obsahuje assety pre miestnosti a levely ako `room1`, `room2`, `room3` a levely `1` az `10`.

---

## Slide 7: NPC sprievodca

Hra obsahuje system NPC sprievodcu.

Hraci sa mozu v hre rozpravat s NPC a pytat sa na:

- Ovladanie.
- Nepriatelov.
- Portaly.
- Zdravie.
- Zlato.
- Trading.
- Co maju robit dalej.

Angular komponent hry vie volat `/api/npc-chat` pre dynamicke odpovede, ale obsahuje aj lokalne nahradne odpovede, aby hra fungovala aj bez backendu.

---

## Slide 8: Pouzivatelske ucty

OverBound podporuje pouzivatelske ucty cez Angular authentication service.

Funkcie uctu:

- Login a registracia.
- Ukladanie aktualnej session hraca.
- Display name hraca.
- Profilova fotka.
- Bio.
- Role `Admin` a `Player`.
- Zostatok zlata.
- Celkove ziskane zlato.
- Inventar.
- Equipnute kozmeticke predmety.

Aplikacia vie pouzit Firebase Authentication a Firestore, ak su nakonfigurovane, a zaroven si nechava fallback spravanie cez LocalStorage.

---

## Slide 9: Zlato a postup

Zlato je hlavna odmenova mena.

Ked hrac porazi nepriatela:

- Hra zavola Angular cast aplikacie.
- Prihlasenemu hracovi sa zvysi pocet zlata.
- Aktualizuje sa celkove ziskane zlato.
- HUD zobrazi ziskane zlato.
- Leaderboard moze zoradovat hracov podla zlata alebo item progressu.

Tymto sa real-time canvas gameplay prepaja s Angular systemom uctov.

---

## Slide 10: Obchod

Projekt obsahuje obchod, kde mozu prihlaseni hraci minat zlato na kozmeticke predmety.

Aktualne typy predmetov v obchode:

- Profilove ramiky.
- Skiny postavy.

Priklady predmetov:

- Solar Flare Frame.
- Frostbite Frame.
- Neon Circuit Frame.
- Royal Nova Frame.
- Blossom Wave Frame.
- Purple Character Skin.
- Green Character Skin.

Equipnute skiny postavy sa aplikuju pri spusteni hry.

---

## Slide 11: Trading system

OverBound obsahuje funkciu vymeny predmetov medzi hracmi.

Trading system podporuje:

- Posielanie trade offerov.
- Vyber predmetov, ktore hrac ponuka.
- Ziadanie predmetov od ineho hraca.
- Prijimanie trade offerov.
- Prijatie, odmietnutie, dokoncenie alebo zrusenie tradov.
- Sledovanie statusu tradov.
- Trade notifikacie.
- Expiraciu a cistenie starych vyriesenych tradov.

Inventar tym nie je iba single-player odmena, ale aj socialna funkcia.

---

## Slide 12: Forum system

Projekt obsahuje komunitne forum.

Funkcie fora:

- Vytvaranie prispevkov.
- Odpovedanie pomocou komentarov.
- Kategorie ako help, showcase, trade a general.
- Triedenie prispevkov.
- Volitelne nahravanie obrazkov.
- Sledovanie neprecitanych odpovedi.
- Zakladne filtrovanie nevhodnych slov.
- Podpora skrytych prispevkov a komentarov.

Forum dava hracom miesto, kde mozu poziadat o pomoc, ukazat progres a riesit trading.

---

## Slide 13: Leaderboard

Start screen obsahuje leaderboard panel.

Hraci mozu byt zoradeni podla:

- Najviac zlata.
- Najviac predmetov.

Leaderboard pouziva data z uctu, napriklad display name, avatar, zlato, inventar a profilove informacie.

Vytvara to sutazenie a dava hracom dovod pokracovat v hrani.

---

## Slide 14: Tech stack

Frontend framework:

- Angular 21.
- Standalone Angular komponenty.
- Angular Router.
- Angular Forms.

Hernu cast tvori:

- HTML5 Canvas.
- Plain JavaScript subory herneho enginu.
- Animacia zalozena na spritoch.
- Collision blocks.
- Vlastne triedy pre hraca, nepriatelov, NPC, kameru a sprity.

Backend a perzistencia:

- Firebase Authentication.
- Firestore.
- Firebase Storage pre uploady vo fore.
- LocalStorage fallback pre lokalny vyvoj.

Tooling:

- Angular CLI.
- TypeScript.
- npm.
- Vitest / Angular unit test setup.
- Konfiguracne subory pre Firebase Hosting.

---

## Slide 15: Struktura projektu

Dolezite priecinky a subory:

- `src/app`: Angular stranky, routing, komponenty a services.
- `src/app/services`: Sluzby pre authentication, Firebase, forum a trading.
- `src/app/store`: Store katalog a definicie predmetov.
- `src/assets/js`: Plain JavaScript herny engine.
- `src/assets/js/classes`: Herny triedy ako Player, Enemy, NPC, Camera a Sprite.
- `src/assets/data`: Kolizne a level data.
- `src/assets/sprites`: Sprity postavy, nepriatelov, levelov, portalov, health baru a UI.
- `src/assets/sounds`: Zvukove assety hry.
- `angular.json`: Angular build konfiguracia a poradie nacitavania scriptov.

---

## Slide 16: Integracia Angularu a hry

Projekt kombinuje Angular a plain JavaScript canvas hru.

Angular riesi:

- Routing.
- Login.
- Data uctu.
- Obchod.
- Trading.
- Forum.
- Leaderboard.
- UI obrazovky.

JavaScript hra riesi:

- Canvas rendering.
- Animacnu slucku.
- Fyziku.
- Detekciu kolizii.
- Ovladanie hraca.
- Spravanie nepriatelov.
- Prechody cez portaly.

Tieto dve vrstvy spolu komunikuju cez browser globals a custom events, napriklad ked hra prideli zlato alebo otvori NPC chat.

---

## Slide 17: Demo user flow

Dobra ukazka projektu:

1. Otvorit start screen.
2. Ukazat leaderboard a obchod.
3. Otvorit nastavenia a ukazat prisposobitelne ovladanie.
4. Prihlasit sa alebo ukazat account cast.
5. Spustit hru.
6. Prejst levelom a porozpravat sa s NPC.
7. Najst portal a prejst do dalsej oblasti.
8. Bojovat s nepriatelom a ziskat zlato.
9. Vratit sa do obchodu a ukazat kozmeticke predmety.
10. Ukazat trading a forum stranky.

---

## Slide 18: Silne stranky projektu

OverBound ukazuje viacero dolezitych vyvojarskych zrucnosti:

- Vytvorenie kompletnej Angular aplikacie.
- Integracia vlastnej canvas hry do moderneho frontend frameworku.
- Sprava pouzivatelskych uctov a perzistentnych dat hracov.
- Navrh znovupouzitelnych services pre auth, trading a forum logiku.
- Prepojenie gameplay odmien s web app funkciami.
- Pouzitie Firebase pre real-time a hosted data funkcie.
- Organizacia hernych assetov, spritov, levelov a koliznych dat.

---

## Slide 19: Mozne buduce vylepsenia

Buduce vylepsenia mozu zahrnat:

- Viac levelov a typov nepriatelov.
- Boss fighty.
- Viac kozmetickych predmetov v obchode.
- Nastavenia zvukov a hudby.
- Achievementy.
- Lepsiu podporu pre mobilne zariadenia.
- Pokrocilejsie admin nastroje.
- Vylepsene backend API pre NPC chat.
- Multiplayer alebo live pritomnost hracov.
- Viac automatizovanych testov pre services a integraciu hry.

---

## Slide 20: Zaver

OverBound je plnohodnotny webovy herny projekt, nie iba jednoducha Angular stranka.

Spaja 2D platformovu hratelnost, vlastne pixelove assety, pouzivatelske ucty, odmeny, kozmetiku, trading, forum komunikaciu a sutazenie v leaderboarde do jednej Angular aplikacie.

Projekt ukazuje vyvoj hry aj vyvoj webovej aplikacie v jednom produkte.
