// Quick mode: used when a workspace has no Series Bible. There is no fixed character, no product list and no
// brand rule. The AI takes the topic and product from the successful Reel itself, and the prompts ask Google Flow
// to keep the person from the attached reference photo. Add a real Series Bible later if you want a fixed
// character and exact product looks in every video.

import type { SeriesBible } from "./types";

// A neutral finished content, shown to the AI as the format and quality bar (no brand, no sign-off).
const LITE_EXAMPLE = "[[HOOK]]\nBu, kulkasnya kok bunyi dengung terus tiap malam?\n[[PROBLEM]]\nBunyi dengung membuat tidak nyaman dan banyak yang mengira kulkas rusak.\n[[SOLUTION]]\nCek jarak ke tembok, bersihkan debu, dan pastikan kulkas berdiri rata.\n[[CTA]]\nTulis di komentar kalau kulkasmu begini juga.\n[[FRAME1]]\nHost menatap kamera di dapur sambil menunjuk kulkas\n[[FRAME2]]\nHost memeriksa jarak kulkas ke tembok\n[[FRAME3]]\nHost membersihkan debu di belakang kulkas\n[[FRAME4]]\nHost tersenyum menutup, tangan menunjuk ke kolom komentar\n[[TIMING1]]\nHost membuka dengan pertanyaan ke kamera\n[[TIMING2]]\nClose-up jarak kulkas dan tembok\n[[TIMING3]]\nHost membersihkan debu dengan kuas\n[[TIMING4]]\nHost menutup dengan ajakan komentar\n[[SPOKEN_NAMES]]\nkulkas\n[[DIALOGUE]]\nHost (menatap kamera, membuka): \"Bu, kulkasnya kok bunyi dengung terus tiap malam? Banyak yang ngira itu rusak, padahal sering kali penyebabnya sepele dan bisa dicek sendiri di rumah dalam beberapa menit saja.\"\nHost (menunjuk bagian belakang kulkas): \"Pertama, coba lihat jarak kulkas ke tembok. Kalau terlalu rapat, udara panas susah keluar, jadi kompresornya bekerja lebih keras dan suaranya lebih terdengar jelas dari biasanya.\"\nHost (membersihkan debu): \"Kedua, bersihkan debu di bagian belakang dan bawah. Debu yang menumpuk membuat pendinginan kurang lancar. Pakai kuas halus atau kain kering saja, pelan-pelan, dan jangan lupa cabut kabelnya dulu supaya aman.\"\nHost (tersenyum): \"Ketiga, pastikan kulkas berdiri rata. Kalau miring sedikit saja, getarannya bisa terdengar sampai ke kamar. Cukup atur kaki penyangganya sampai kulkas benar-benar stabil di lantai.\"\nHost (menutup): \"Kalau sudah dicek semua tapi bunyinya masih sama, baru hubungi teknisi resmi. Menurut kamu, kulkas di rumahmu bunyinya begini juga nggak? Tulis di komentar ya.\"\n[[OVERLAY1]]\nKulkas bunyi dengung terus?\n[[OVERLAY2]]\nCek jarak ke tembok\n[[OVERLAY3]]\nBersihkan debunya\n[[OVERLAY4]]\nKulkasmu begini juga?\n[[CAPTION]]\nKulkas bunyi dengung tiap malam? Coba 3 hal ini dulu.\n\nTulis di komentar kalau kulkasmu begini juga!\n\n#TipsRumah #Kulkas";

export const LITE_BIBLE: SeriesBible = {
  seriesName: "Quick mode (no Series Bible)",
  hostName: "Host",
  lite: true,
  host: "PRESENTER — use the person shown in the attached character reference photo(s). Keep the face, hair, skin tone, outfit and accessories identical in every shot. Natural skin texture with visible pores, do not over-smooth, do not plastic-skin. Modest, natural clothing.",
  location: "LOCATION — keep the same setting as the reference photo. One location for the whole video, no other locations.",
  hostVoice: "VOICE: natural, warm, conversational Indonesian voice matching the presenter's age and personality, unhurried pace with natural breathing pauses, never rushed and never salesy. Speaks casual Bahasa Indonesia like talking to a friend.",
  taglines: { main: "", long: "", signoff: "" },
  outfits: [{ key: "as_reference", label: "As in the reference photo", text: "the same outfit as in the character reference photo" }],
  products: [],
  guests: [],
  blocks: {
    imageHeader: "STORYBOARD — 4 frames in 1 reference image, 9:16 vertical, photorealistic, 4K.",
    videoHeader: "VIDEO PROMPT — Google Flow / Veo | ~40 seconds total | 9:16 | Realistic",
    identityLock: "",
    mood: "MOOD — natural, warm and believable, like real creator footage. No exaggerated acting, no fear framing, no competitor mentions, no claims beyond what the real product can do.",
    lensLight: "LENS & LIGHT: 35mm, eye-level, soft natural light, shallow depth of field. Keep natural skin texture. REALISM: this must read as a real photograph of an actual person, NOT a 3D render, NOT an illustration, NOT a glossy 'AI image' look. No text, captions or watermark inside the image.",
    cameraVideo: "CAMERA: 35mm, eye-level, gentle handheld or slow slider movement. 9:16 vertical, 4K. REALISM: this must look like real camera footage of an actual person, NOT a cartoon, NOT 3D animation, NOT a glossy AI-video look. Keep natural human micro-movements: slight head sway, natural blinking, the light handheld imperfection of a real phone shot.",
    referenceNote: "REFERENCE: attach the character reference photo(s) and the real product photo of whatever is shown in this clip to every generation. Face, outfit and product must match the references exactly.",
    storyboardNote: "Arrange as a 4-panel storyboard (2x2 grid or vertical strip). Each frame keeps empty text space (top or bottom) for overlays added in editing. No text, captions or watermark baked into the image itself.",
    productPrefix: "PRODUCT — must match the attached product photo exactly: ",
    productSuffix: "",
    mandatory: "MANDATORY: the presenter clearly says the product or topic name in the dialogue: {SPOKEN_NAMES}.",
    timingHeader: "CAMERA TIMING (one continuous take, smooth transitions between segments):",
    scriptHeader: "SCRIPT — dialogue flows in ONE continuous breath from start to end (~{WORDS} words, no silent gaps; if the video AI leaves empty time, extend a small gesture in the last frame instead of leaving silence):",
    overlayHeader: "TEXT OVERLAY (added in editing, NOT generated by the video AI):",
    noOverlayNote: "No subtitles. No on-screen captions burned into the video. No background music. No narrator.",
    durationNote: "DURATION NOTE: the result should come close to the full ~40 seconds with the dialogue above. If the tool cuts it shorter, use extend/regenerate with the same seed instead of adding silence.",
    multiCharNote: "",
  },
  rules: [
    "Wajib ada satu pembicara per bidikan.",
    "Pertahankan struktur konten sumber: urutan beat Hook, Problem, Solution, CTA dan tempo hook-nya, tetapi ganti situasi, contoh, dan kalimatnya.",
    "Jangan mengarang statistik, angka, harga, spesifikasi, testimoni, atau hasil. Sebut hanya fungsi umum yang pasti benar.",
    "Brand safe: tanpa fear framing, tanpa menyebut kompetitor.",
    "Dialog mengalir satu napas, sekitar 105-125 kata untuk ~40 detik, tempo tenang, tanpa jeda diam.",
    "Teks overlay ditambahkan saat editing, bukan di-generate; tanpa subtitle, tanpa musik latar, tanpa narator.",
  ],
  example: LITE_EXAMPLE,
  exampleMeta: { format: "REELS · Tips Cepat", title: "Kulkas Bunyi Aneh", product: "kulkas" },
};
