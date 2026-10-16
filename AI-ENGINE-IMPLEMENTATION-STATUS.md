स्वर-साधिका — AI इंजन एकीकरण स्थिति एवं पूर्णता योजना
ऑडिट अद्यतन: 17 अक्टूबर 2026
परीक्षण रिपॉज़िटरी: shreevidyamatabhuvanesvari-gif/swar-sadhika-test
GitHub Pages: https://shreevidyamatabhuvanesvari-gif.github.io/swar-sadhika-test/
सीमा: मुख्य ऐप anujadha को न खोलें, न बदलें, न उसमें कोई फ़ाइल भेजें।
1. निष्कर्ष — अभी PASS नहीं
उपलब्ध swar-sadhika-test-patched-2.zip और उसके स्रोतों के ऑडिट से यह प्रमाणित नहीं होता कि ऐप अभी स्वतंत्र, वास्तविक AI inference करके संस्कृत ऑडियो बना सकता है। ZIP में UI, text utilities, adapter, cache/service worker, परीक्षण पृष्ठ और vendor workflow/script हैं। लेकिन upstream Vāgdhenu browser engine और उसके सभी आवश्यक runtime assets का पूरा, लाइसेंस-सत्यापित स्थानीय bundle मौजूद नहीं है।
किसी function का नाम synthesizeInBrowser() होना, module import हो जाना, model files cache हो जाना या progress bar पूरा होना वास्तविक synthesis का प्रमाण नहीं है। PASS के लिए नया, गैर-रिक्त ऑडियो बनना, playback और नेटवर्क बंद करके दोबारा synthesis आवश्यक हैं।
2. अनिवार्य आवश्यकताएँ
कोई paid AI API, API key, subscription या अलग inference server अनिवार्य न हो।
Inference उपयोगकर्ता के ब्राउज़र/डिवाइस में हो।
पहली बार आवश्यक इंजन/runtime/model assets इंटरनेट से डाउनलोड हो सकते हैं; डाउनलोड पूरा होने पर offline परीक्षण सफल होना चाहिए।
Android मोबाइल और GitHub Pages पर परीक्षण हो।
वास्तविक संस्कृत पाठ से audio output बने; नकली WAV, prerecorded fallback या केवल browser speech playback को AI singing न बताया जाए।
लक्ष्य मधुर, स्पष्ट, स्त्री-स्वर-अनुकूल संस्कृत chanting है। Vāgdhenu उपलब्ध हो भी जाए, तो स्वतंत्र धुन-रचना और स्त्री-स्वर गुणवत्ता अलग से जाँची जाएगी।
हर निर्भरता और मॉडल का स्रोत, version/commit, लाइसेंस और फ़ाइल आकार दर्ज हों।
anujadha मुख्य ऐप में कोई बदलाव नहीं।
3. उपलब्ध फ़ाइलों का ऑडिट
फ़ाइल/समूह
ऑडिट निष्कर्ष
index.html, app.js
UI और app-side engine call मौजूद हैं; इससे इंजन उपलब्ध होने का प्रमाण नहीं मिलता।
index.js
अपेक्षित engine API/adapter और synthesis call उपलब्ध हैं; अंतर्निहित वास्तविक engine के बिना यह अपने आप inference नहीं करता।
vagdhenu-onnx.js
Compatibility/source-loading adapter है। इसमें बाहरी upstream URL fallback हैं; यह पूरा upstream engine implementation नहीं है।
vagdhenu-text.js
संस्कृत/देवनागरी पाठ विश्लेषण का utility module है; AI audio model नहीं।
model-cache.js
Hugging Face से model assets cache करने की व्यवस्था है। Cache hit से model compatibility या inference की पुष्टि नहीं होती।
service-worker.js
app shell और चुने गए cross-origin assets cache करने का प्रयास करता है। Offline coverage को वास्तविक offline run से सिद्ध करना होगा।
singing-engine-prototype.html, vagdhenu-inference-audit*.html
Diagnostic/test pages हैं; production engine नहीं।
vagdhenu-runtime-audit.html
Runtime/model asset path जाँचने में उपयोगी; वास्तविक synthesis और offline PASS का विकल्प नहीं।
neural-studio.html
बाहरी studio embed/link है; स्थानीय/offline engine नहीं।
scripts/fetch-vagdhenu-engine.sh
Upstream स्रोत fetch/vendor करने का प्रयास करता है; लाइसेंस की जाँच जानबूझकर करता है।
.github/workflows/vendor-vagdhenu-engine.yml
Test repo में vendor प्रक्रिया चलाने के लिए; license gate हटाना सुरक्षित समाधान नहीं।
पुराना AI-ENGINE-IMPLEMENTATION-STATUS.md
इसमें workflow के नेटवर्क/DNS के कारण न चलने की बात थी। बाद के वास्तविक workflow run में अधिक विशिष्ट परिणाम मिला: upstream repository में top-level license file नहीं मिली।
4. सत्यापित अवरोध
A — Upstream JavaScript source का लाइसेंस/अनुमति
पिछली GitHub Actions run में Fetch genuine upstream source चरण इस संदेश के साथ विफल हुआ:
ERROR: No top-level upstream license file was found. Do not vendor the source until its license or written permission is verified.
इसका अर्थ यह नहीं कि लेखक ने निश्चित रूप से अनुमति देने से मना किया है; इसका अर्थ है कि उपलब्ध प्रमाण से source redistribution/vendoring permission स्थापित नहीं हुई। इसलिए workflow का license guard न हटाएँ और upstream code test repo में commit न करें, जब तक स्पष्ट license या लिखित अनुमति की पुष्टि न हो।
Model weights का MIT license, JavaScript engine source के license की जगह नहीं लेता। प्रत्येक घटक का license अलग जाँचना आवश्यक है।
B — इंजन/runtime का पूरा स्थानीय bundle
मौजूदा adapter बाहरी URLs से upstream module import करने का प्रयास करता है। model-cache.js model assets डाउनलोड कर सकता है, पर इससे upstream JavaScript, ONNX Runtime JS/WASM, सहायक modules और सभी model files अपने-आप स्थानीय नहीं हो जाते।
C — वास्तविक inference और ऑडियो
उपलब्ध सामग्री में वास्तविक generated audio और playback का स्वतंत्र प्रमाण नहीं है। inferenceClaim/status को not-independently-verified ही रखें, जब तक नीचे के परीक्षण पास न हों।
D — Offline reliability
Service worker का मौजूद होना offline mode का प्रमाण नहीं है। Cross-origin cache restrictions, storage quota/eviction, redirects, range requests, runtime WASM paths और पहली बार download का व्यवहार Android पर जाँचना होगा।
5. पूरा करने की सुरक्षित कार्ययोजना
चरण 1 — स्रोत-अनुमति
Upstream author से लिखित अनुमति या स्पष्ट पुनर्वितरण-योग्य license प्राप्त करें; या
ऐसा वैकल्पिक browser engine चुनें जिसका source license स्पष्ट हो और जिसकी API/model इस ऐप के लिए उपयुक्त हो।
अनुमति/लाइसेंस और exact source commit दर्ज किए बिना vendor workflow दोबारा न चलाएँ।
चरण 2 — निर्भरताओं को test repo में वैध रूप से bundle करना
सभी आवश्यक JavaScript modules, ONNX Runtime JS/WASM binaries, model configuration/tokenizer files और model weights के लिए exact version/commit pin करें; source URL और license दर्ज करें; उपलब्ध होने पर SHA-256 digest सत्यापित करें; runtime references को स्थानीय files पर निर्देशित करें; पूर्ण offline लक्ष्य होने पर remote CDN fallback को आवश्यक dependency न रहने दें।
चरण 3 — Adapter को वास्तविक implementation से जोड़ना
index.js के अपेक्षित API और वास्तविक upstream API का signature-by-signature मिलान करें।
wasm और onnx/WebGPU नाम तभी स्वीकारें जब upstream वास्तव में उन backends का समर्थन करता हो।
Raw bytes को सही audio format metadata के बिना WAV न घोषित करें।
Initialization/synthesis failure पर साफ error दें; नकली audio या सफलता का झूठा status न दें।
Model initialization और inference की सफलता अलग-अलग दर्ज करें।
चरण 4 — GitHub Pages पर end-to-end परीक्षण
Android Chrome में test repo का HTTPS page खुलता है।
आवश्यक local JS modules/runtime assets HTTP 200 के साथ load होते हैं।
Model initialization वास्तविक रूप से सफल होती है।
छोटा संस्कृत पाठ देकर non-empty WAV/Blob या वैध audio output बनता है।
Output MIME/container, duration और playback जाँचे जाते हैं।
Browser console में fatal errors नहीं हैं।
परिणाम download और पुनः playback किया जा सकता है।
चरण 5 — वास्तविक offline परीक्षण
Online रहते हुए ऐप खोलें और model/runtime downloads पूरी होने दें।
Service worker active होने की पुष्टि करें और page reload करें।
Android पर airplane mode/नेटवर्क बंद करें।
Page को दोबारा खोलें।
बिना नेटवर्क के model initialization और नया संस्कृत audio generation दोहराएँ।
Offline में नया output सफल होने का प्रमाण दर्ज करें। पहले से बने audio को चलाना पर्याप्त नहीं है।
चरण 6 — लक्ष्य-गुणवत्ता जाँच
उच्चारण/संयुक्ताक्षर, दीर्घ-ह्रस्व, वैदिक चिह्न, छंद/विराम, स्वर की मधुरता/स्पष्टता/स्त्री-स्वर गुण, लंबे पाठ पर memory/battery/thermal व्यवहार जाँचें। यदि upstream model केवल chant-style speech देता है, तो उसे स्वतंत्र melody-generation या female singing engine न कहें।
6. PASS/FAIL तालिका
जाँच
वर्तमान स्थिति
UI और adapter files मौजूद
उपलब्ध ZIP में मौजूद
Upstream source license/permission verified
BLOCKED
पूरा upstream engine locally vendored
FAIL / supplied ZIP में मौजूद नहीं
Runtime JS/WASM locally bundled
NOT VERIFIED
Model files और digests verified
NOT VERIFIED
Real model initialization
NOT VERIFIED
Real non-empty generated audio
NOT VERIFIED
Android playback
NOT VERIFIED
Network disabled रहते fresh synthesis
NOT VERIFIED
Melodic/feminine-friendly singing quality
NOT VERIFIED
Paid API/server dependency
वर्तमान डिज़ाइन में जोड़ी नहीं गई; पूरे stack audit के बाद ही अंतिम पुष्टि
anujadha untouched
अनिवार्य कार्य-सीमा
7. निःशुल्क उपयोग
इस परियोजना में paid AI API, API key या अलग inference server जोड़ना आवश्यक समाधान का हिस्सा नहीं है। GitHub Pages और public repository का निःशुल्क उपयोग संभव है, पर model/source की license शर्तें लागू रहेंगी। पहली बार model download में मोबाइल डेटा और सैकड़ों MB storage लग सकता है; browser storage की सीमाएँ भी हो सकती हैं।
जब तक इंजन और निर्भरताएँ सत्यापित न हों, यह दावा न करें कि अंतिम ऐप offline-ready है या सभी घटक कानूनी रूप से redistribute किए जा सकते हैं। कोई अनिवार्य भुगतान सामने आए तो पहले उपयोगकर्ता को बताया जाए; स्पष्ट सहमति के बिना paid service न जोड़ी जाए।
8. अगला अनुमत कदम
पहले upstream author से लिखित permission/license स्पष्ट करें। उसके बाद ही test repository में वास्तविक engine source और आवश्यक runtime assets bundle करें। अनुमति न मिले तो स्पष्ट license वाला वैकल्पिक browser engine चुनें और उसकी वास्तविक synthesis क्षमता का अलग prototype test करें।
निष्कर्ष: यह status file स्वयं AI engine नहीं है और इसे अपडेट करने से inference अपने-आप चालू नहीं होगा। वास्तविक पूर्णता के लिए वैध source + सभी runtime/model assets + वास्तविक audio output + network-off synthesis test अनिवार्य हैं। कोई चरण PASS घोषित न करें जब तक उसके प्रमाण उपलब्ध न हों।
