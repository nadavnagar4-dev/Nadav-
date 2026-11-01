const TOPIC='Iron Deficiency Anemia';

const INTRO=`<h2>Okay Nadav, this presentation is about <span class="t">Iron Deficiency Anemia</span></h2>
<p>Without enough iron the body can't build enough hemoglobin, so the blood carries less oxygen.</p>
<table><tr><th>Slides</th><th>Topic</th></tr>
<tr><td>1</td><td>Why it happens and what the blood smear shows</td></tr>
<tr><td>2</td><td>Diagnosis and treatment</td></tr></table>`;

const OUTRO=`<h2>Exam tip</h2>
<table><tr><th>Question</th><th>Answer</th></tr>
<tr><td>Blood smear</td><td>Microcytic, hypochromic</td></tr>
<tr><td>First lab to drop</td><td>Ferritin</td></tr>
<tr><td>Treatment</td><td>Oral iron, and find the source of bleeding</td></tr></table>`;

const S=[
{t:'Intro',html:INTRO,s:[E("Hey Nadav! Okay Nadav, this presentation is about iron deficiency anemia."),E("Without iron, the body can't build enough hemoglobin, so the blood carries less oxygen. Simple, right?")]},
{t:'Why it happens',html:`<h2>Why does it happen?</h2><p>In adults: chronic blood loss, from the gut or heavy periods.</p><p>Smear: small, pale cells, microcytic and hypochromic.</p>`,s:[E("So why does it happen? In adults, the most common cause is chronic blood loss. From the gut, for example, or heavy periods."),E("And what do you see on the blood smear? Small, pale cells... microcytic and hypochromic."),E("Remember that one. It's a classic on the exam.")]},
{t:'Diagnosis and treatment',html:`<h2>Diagnosis and treatment</h2><p>The key test: ferritin, and it drops first.</p><p>Treatment: oral iron, I V iron in severe cases, and always look for the bleeding.</p>`,s:[E("How do you diagnose it? The most important test is ferritin. It drops first, even before the hemoglobin falls."),E("And the treatment? Oral iron, and I V iron in severe cases. But wait... you always look for where the bleeding is coming from.")]},
{t:'Exam tip',html:OUTRO,s:[E("And before you go, an exam tip. Small, pale cells and a low ferritin? That's iron deficiency until proven otherwise."),E("Good luck, Nadav!")]}
];

// optional: words the voice says wrong -> how to say them, e.g. {"Tzanck":"Zank"}
const SAY={};
