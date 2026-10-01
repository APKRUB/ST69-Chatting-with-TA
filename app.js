// ตั้งค่าการเชื่อมต่อ Supabase (เปลี่ยนค่าด้านล่างนี้เป็นของตัวเอง)
const SUPABASE_URL = 'https://zbytsducqtvmbnatzuyl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpieXRzZHVjcXR2bWJuYXR6dXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjMzODQsImV4cCI6MjEwNjQzOTM4NH0.JUJiVV-I5Qtu7L_FMnhioS4xgEi9uTV1B_ZlBb-8zNg';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

// 1. ตรวจสอบว่าผู้ใช้ล็อกอินอยู่หรือยังตอนเปิดเว็บ
async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('user-info').innerText = `👤 ${currentUser.email}`;
        
        // โหลดข้อมูลเริ่มต้น
        loadMessages();
        loadAnnouncements();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
}

// 2. ปุ่ม Login ด้วย GitHub
document.getElementById('login-btn').addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin }
    });
    if (error) alert('Login Error: ' + error.message);
});

// 3. ปุ่ม Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
});

// 4. สลับหน้าแท็บเมนู
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
}

// 5. ระบบแชทพื้นฐาน (ดึงข้อความ & ส่งข้อความ)
async function loadMessages() {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (error) {
        console.error(error);
        return;
    }
    
    const container = document.getElementById('chat-messages');
    container.innerHTML = data.map(msg => `
        <div class="p-3 bg-white rounded-xl shadow-sm max-w-md border border-slate-100 ${msg.sender_id === currentUser.id ? 'ml-auto bg-indigo-50/50' : ''}">
            <p class="text-sm text-slate-700">${msg.content}</p>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    const { error } = await supabase.from('messages').insert([{
        sender_id: currentUser.id,
        content: content
    }]);

    if (!error) {
        input.value = '';
        loadMessages();
    } else {
        alert('ส่งข้อความไม่สำเร็จ: ' + error.message);
    }
}

// 6. ระบบกดเรียกพี่ (SOS)
async function sendSOS() {
    const tableNo = document.getElementById('sos-table').value.trim();
    const topic = document.getElementById('sos-topic').value.trim();
    if (!tableNo || !topic) {
        alert('กรุณากรอกเลขที่โต๊ะและหัวข้อที่ติดปัญหาให้ครบถ้วน');
        return;
    }

    const { error } = await supabase.from('sos_requests').insert([{
        student_id: currentUser.id,
        table_no: tableNo,
        topic: topic,
        status: 'pending'
    }]);

    if (!error) {
        alert('🚨 ส่งสัญญาณเรียกพี่สำเร็จ พี่ๆ กำลังไปหาครับ!');
        document.getElementById('sos-topic').value = '';
    } else {
        alert('ส่ง SOS ไม่สำเร็จ: ' + error.message);
    }
}

// 7. โหลดประกาศ
async function loadAnnouncements() {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) return;

    const container = document.getElementById('announcement-list');
    if (data.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400">ยังไม่มีประกาศจากค่ายในขณะนี้</p>`;
        return;
    }

    container.innerHTML = data.map(ann => `
        <div class="p-4 bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-indigo-600">
            <h3 class="font-bold text-slate-800">${ann.title}</h3>
            <p class="text-sm text-slate-600 mt-1">${ann.content}</p>
        </div>
    `).join('');
}

// เริ่มต้นเช็ก User ทันทีที่เปิดหน้าเว็บ
checkUser();
