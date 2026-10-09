// Knowledge section: what the copilot knows about you (the team's documents are in the backoffice)
import { defineMessages } from '.'

export const knowledge = defineMessages({
  question: { id: 'Apa yang AI ketahui tentang saya?', en: 'What does the AI know about me?' },
  me_title: { id: 'Catatan tentang Anda', en: 'Notes about you' },
  me_sub: { id: 'Hanya Anda yang melihatnya. Copilot memakainya sebagai konteks, misalnya "klien saya".', en: 'Only you see these. The copilot uses them as context, e.g. "my clients".' },
  me_placeholder: { id: 'mis. Saya memegang klien CL-1004 dan CL-1002', en: 'e.g. I look after clients CL-1004 and CL-1002' },
  me_add: { id: 'Simpan catatan', en: 'Save note' },
  me_none: { id: 'Belum ada catatan. Tulis di atas, atau minta Copilot: "ingat bahwa …".', en: 'No notes yet. Write one above, or ask the copilot: "remember that …".' },
  from_chat: { id: 'dari chat', en: 'from chat' },
})
