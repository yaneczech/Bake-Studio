Technické zadání: Bake Studio (TS-1)

Verze: 1.1 (Duben 2026)

Cíl: Vytvořit authoringový nástroj pro přípravu AI-interpolovaných VJ smyček v otevřeném formátu `.vjb`.

1. Jádro systému (The Engine)

Software funguje jako orchestrátor mezi uživatelským vstupem, AI modely a video kodéry.

A. AI interpolační modul

- Implementace: integrace RIFE v4.x přes `rife-ncnn-vulkan`
- Vlastnosti:
- Podpora `fp16` precision s automatickou aktivací na Apple Silicon a RTX kartách
- Možnost volby cílového FPS: `auto`, `120`, `240`
- Volitelný upscale: integrace Real-ESRGAN před interpolací

B. Video I/O a decoding

- Vstup: ProRes (`422`, `4444`, `Log`), `H.264`, `H.265`
- macOS: využití VideoToolbox pro HW akceleraci ProRes decode
- Výstup (`The Bake`):
- Primární: `HAP Q` pro Windows a univerzální playback
- Sekundární: `ProRes 4444` pro Mac a alpha workflow
- Autoritativní zápis flagu `media.primaryVideo.alpha` do manifestu

2. Specifikace formátu (`.vjb`)

Zápis musí striktně odpovídat specifikaci v repozitáři `vjb-format`.

- Metadata generator:
- automatický výpočet `source.durationMs`
- automatický výpočet `source.fpsNominal`
- automatický výpočet `source.frameCount`
- automatický výpočet `media.primaryVideo.alpha`
- Marker system:
- markery se zapisují do pole `markers`
- každý marker obsahuje objekt `state` s parametry `mode`, `direction`, `speed`
- `direction` v exportovaném manifestu nesmí být `0`
- Naming convention: důsledné používání `camelCase` v celém JSON manifestu

3. Časové báze a převod snímků

Bake Studio pracuje se dvěma frame prostory:

- `source frame space`: původní video, ve kterém uživatel authoruje markery
- `baked frame space`: interpolované exportované video, které se zapisuje do `.vjb`

Normativní pravidla pro implementaci:

- editor ukládá marker interně jako `sourceFrame`
- exportér převádí markery do baked frame space podle poměru `targetFps / source.fpsNominal`
- do finálního `manifest.json` se zapisuje `markers[].frame` vždy v baked frame space
- validace `.vjb` markerů se provádí proti `media.primaryVideo.frameCount`
- jedna centrální rounding strategie musí být použita konzistentně v preview, exportu i segment logice

4. UI/UX architektura (The Studio)

Rozhraní musí být optimalizované pro rychlou práci s rytmickým materiálem.

A. Timeline a scrubbing

- Filmstrip view: generování thumbnail stripu na pozadí pro celou časovou osu
- Rhythm grid: možnost zapnout mřížku podle BPM pro přesné umisťování markerů
- Hotkeys: klávesy `1-9` pro okamžité vložení markeru na pozici playheadu

B. Marker inspector

- Panel pro editaci vybraného markeru:
- změna frame číselně i tahem
- nastavení entry behavior přes menu pro `mode`
- interaktivní dial pro `direction` se snapem na `-1.0` a `1.0`
- `0.0` může existovat pouze jako interní UI mezistav, nesmí být zapsáno do exportovaného manifestu

C. Preview engine

- Smart proxy: při rychlém scrubbingu zobrazovat zdrojové video nebo proxy
- AI preview: při zastavení na snímku provést rychlou AI interpolaci pro náhled výsledné plynulosti

5. Workflow (uživatelská cesta)

- Import: uživatel přetáhne ProRes Log video z iPhonu
- Enhance: volitelně zapne upscale na 4K a aplikuje základní color correction
- Index: projde video a na klíčové momenty nasází markery, například `m_hit`, `m_build`
- Define states: u markeru `m_reverse` nastaví `direction: -1.0` a `mode: pingpong`
- Bake: klikne na tlačítko, proběhne AI výpočet a vyexportuje se `.vjb` balíček

6. Technický stack

- Platformy: Windows 11, macOS nativně na ARM64
- Desktop shell: Tauri 2
- Frontend: SolidJS + TypeScript
- Struktura repa:
- `apps/studio`: Tauri + SolidJS aplikace
- `packages/project-model`: interní authoring model a frame mapping
- `packages/vjb-core`: VJB manifest typy, validace a packaging
- `packages/media-pipeline`: ffprobe/ffmpeg/rife orchestrace
- `packages/shared`: sdílené utility a typy
- Backend processing: FFmpeg binárka včetně `libavcodec` pro balení HAP a ProRes kontejnerů

7. Akceptační kritéria pro MVP

- [ ] Úspěšné načtení ProRes 422 videa
- [ ] AI interpolace z 30 FPS na 120 FPS bez pádu aplikace
- [ ] Export funkčního `.vjb` balíčku s validním JSON manifestem podle specifikace
- [ ] Korektní převod markerů ze source frame space do baked frame space
- [ ] Funkční scrubbing na timeline bez lagování

Poznámka pro vývojáře:

`media.primaryVideo.alpha` je autoritativní playback flag. Pokud zdroj nemá alfu, ale uživatel chce export s alpha workflow, Bake Studio musí varovat nebo automaticky nastavit flag na `false`, aby renderer ani přehrávač zbytečně nepočítaly alpha větev.
