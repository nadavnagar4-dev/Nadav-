const TOPIC='Iron Deficiency Anemia';

const INTRO=`<h2>אוקיי נדב, המצגת הזאת מדברת על <span class="t">Iron Deficiency Anemia</span></h2>
<p>אנמיה מחוסר ברזל: בלי מספיק ברזל הגוף לא בונה מספיק המוגלובין, והדם מוביל פחות חמצן.</p>
<table><tr><th>שקופיות</th><th>נושא</th></tr>
<tr><td>1</td><td>למה זה קורה ומה רואים בדם</td></tr>
<tr><td>2</td><td>אבחנה וטיפול</td></tr></table>`;

const OUTRO=`<h2>טיפ למבחן</h2>
<table><tr><th>שאלה</th><th>תשובה</th></tr>
<tr><td>משטח דם</td><td><span class="t">microcytic, hypochromic</span></td></tr>
<tr><td>הבדיקה הראשונה שיורדת</td><td><span class="t">Ferritin</span></td></tr>
<tr><td>טיפול</td><td>ברזל דרך הפה, ולחפש את מקור הדימום</td></tr></table>`;

const S=[
{t:'פתיחה',html:INTRO,s:[H('היי נדב. אוקיי נדב, המצגת הזאת מדברת על'),E('Iron Deficiency Anemia'),H('כלומר, אנמיה מחוסר ברזל. בלי ברזל הגוף לא בונה מספיק המוגלובין, ואז הדם מוביל פחות חמצן. פשוט, נכון?')]},
{t:'למה זה קורה',html:`<h2>למה זה קורה?</h2><p>אצל מבוגרים: דימום כרוני, מהמעי או מווסת חזקה.</p><p>במשטח: תאים קטנים וחיוורים, <span class="t">microcytic, hypochromic</span>.</p>`,s:[H('אז למה זה קורה? אצל מבוגרים, הסיבה הכי נפוצה היא דימום כרוני. למשל מהמעי, או מווסת חזקה.'),H('ומה רואים במשטח הדם? תאים קטנים וחיוורים:'),E('microcytic, hypochromic'),H('תזכור את זה, זה קלאסי למבחן.')]},
{t:'אבחנה וטיפול',html:`<h2>אבחנה וטיפול</h2><p>הבדיקה הכי חשובה: <span class="t">Ferritin</span>, והיא יורדת ראשונה.</p><p>טיפול: ברזל דרך הפה, ובמקרים קשים לווריד. ותמיד לחפש את מקור הדימום.</p>`,s:[H('איך מאבחנים? הבדיקה הכי חשובה היא'),E('Ferritin'),H('והיא יורדת ראשונה, עוד לפני שההמוגלובין נופל. והטיפול? ברזל דרך הפה, ובמקרים קשים ברזל לווריד. אבל רגע... תמיד מחפשים גם מאיפה הדימום.')]},
{t:'טיפ למבחן',html:OUTRO,s:[H('ולפני שאתה הולך, טיפ למבחן. אנמיה עם תאים קטנים וחיוורים, ו'),E('Ferritin'),H('נמוך? זה חוסר ברזל, עד שיוכח אחרת. בהצלחה, נדב!')]}
];

// every E(...) text, the way an Israeli lecturer says it
const SAY={"Iron Deficiency Anemia":"איירון דפישנסי אנימיה","microcytic, hypochromic":"מיקרוציטיק, היפוכרומיק","Ferritin":"פריטין"};
// optional: Hebrew words the voice misreads -> the same word with nikud, e.g. {"חלה":"חָלָה"}
const FIX={};
