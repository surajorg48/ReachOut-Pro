const axios = require('axios');

const API_URL = 'https://m3m3m1s7x2n1n88b.aistudio-app.com/layout-parsing';
const TOKEN = 'a14ed1b658452f48713433db1e3966de1d1776bc';

/**
 * Parse a resume file (PDF or image) using the AI layout-parsing API
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} mimeType - MIME type (application/pdf, image/*, etc.)
 * @returns {Promise<{ markdown: string, rawResult: object }>}
 */
async function parseResume(fileBuffer, mimeType) {
    const fileData = fileBuffer.toString('base64');
    // fileType: 0 = PDF, 1 = image
    const fileType = mimeType === 'application/pdf' ? 0 : 1;

    const payload = {
        file: fileData,
        fileType,
        useDocOrientationClassify: false,
        useDocUnwarping: false,
        useChartRecognition: false,
    };

    const response = await axios.post(API_URL, payload, {
        headers: {
            Authorization: `token ${TOKEN}`,
            'Content-Type': 'application/json',
        },
        timeout: 60000,
    });

    if (response.status !== 200) {
        throw new Error(`Layout parsing API returned status ${response.status}`);
    }

    const result = response.data.result;
    const allMarkdown = result.layoutParsingResults.map(r => r.markdown.text).join('\n\n');

    return { markdown: allMarkdown, rawResult: result };
}

/**
 * Extract structured info from resume markdown
 * Uses regex-based heuristics to find key sections
 */
function extractResumeInfo(markdown) {
    const info = {
        name: '',
        email: '',
        phone: '',
        linkedin: '',
        github: '',
        skills: [],
        experience: [],
        education: [],
        projects: [],
        summary: '',
        suggestedBullets: [],
    };

    const lines = markdown.split('\n').map(l => l.trim()).filter(Boolean);

    // Email
    const emailMatch = markdown.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) info.email = emailMatch[0];

    // Phone
    const phoneMatch = markdown.match(/(\+91[\s\-]?)?[6-9]\d{9}|(\+\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/);
    if (phoneMatch) info.phone = phoneMatch[0].trim();

    // LinkedIn
    const linkedinMatch = markdown.match(/linkedin\.com\/in\/[\w\-]+/i);
    if (linkedinMatch) info.linkedin = 'https://' + linkedinMatch[0];

    // GitHub
    const githubMatch = markdown.match(/github\.com\/[\w\-]+/i);
    if (githubMatch) info.github = 'https://' + githubMatch[0];

    // Name: usually the first large heading or first non-blank line
    const nameMatch = markdown.match(/^#\s+(.+)$/m) || markdown.match(/^\*\*(.+?)\*\*/m);
    if (nameMatch) info.name = nameMatch[1].trim();
    else if (lines.length > 0) {
        const firstLine = lines[0].replace(/[#*_]/g, '').trim();
        if (firstLine.length > 2 && firstLine.length < 50 && !/[@.com]/.test(firstLine)) {
            info.name = firstLine;
        }
    }

    // Skills section
    const skillKeywords = ['skills', 'technologies', 'tech stack', 'tools', 'languages', 'frameworks'];
    let inSkills = false;
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (skillKeywords.some(k => lower.includes(k))) { inSkills = true; continue; }
        if (inSkills) {
            if (/^#{1,3}\s/.test(line)) { inSkills = false; continue; }
            const skills = line.replace(/[*•\-|,]/g, ',').split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 30);
            info.skills.push(...skills);
        }
    }
    // Remove duplicates
    info.skills = [...new Set(info.skills)].filter(s => s && !/^\d+$/.test(s)).slice(0, 30);

    // Experience section
    const expKeywords = ['experience', 'work history', 'employment', 'professional background', 'internship'];
    const expLines = [];
    let inExp = false;
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (expKeywords.some(k => lower.includes(k)) && /^#{1,3}\s/.test(line)) { inExp = true; continue; }
        if (inExp) {
            if (/^#{1,3}\s/.test(line) && !expKeywords.some(k => lower.includes(k)) && line.length < 50) { inExp = false; }
            else if (line.startsWith('*') || line.startsWith('-') || line.startsWith('•')) {
                expLines.push(line.replace(/^[*\-•]\s*/, '').trim());
            } else if (line.length > 20) expLines.push(line);
        }
    }
    info.experience = expLines.slice(0, 12);

    // Education
    const eduKeywords = ['education', 'academic', 'qualification', 'degree'];
    const eduLines = [];
    let inEdu = false;
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (eduKeywords.some(k => lower.includes(k)) && /^#{1,3}\s/.test(line)) { inEdu = true; continue; }
        if (inEdu) {
            if (/^#{1,3}\s/.test(line) && !eduKeywords.some(k => lower.includes(k))) { inEdu = false; }
            else if (line.length > 5) eduLines.push(line.replace(/^[*\-•]\s*/, '').trim());
        }
    }
    info.education = eduLines.slice(0, 6);

    // Projects
    const projKeywords = ['project', 'portfolio', 'work samples'];
    const projLines = [];
    let inProj = false;
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (projKeywords.some(k => lower.includes(k)) && /^#{1,3}\s/.test(line)) { inProj = true; continue; }
        if (inProj) {
            if (/^#{1,3}\s/.test(line) && !projKeywords.some(k => lower.includes(k))) { inProj = false; }
            else if (line.length > 5) projLines.push(line.replace(/^[*\-•]\s*/, '').trim());
        }
    }
    info.projects = projLines.slice(0, 10);

    // Summary / Objective
    const summaryKeywords = ['summary', 'objective', 'profile', 'about me', 'overview'];
    let inSummary = false;
    const summaryLines = [];
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (summaryKeywords.some(k => lower.includes(k)) && /^#{1,3}\s/.test(line)) { inSummary = true; continue; }
        if (inSummary) {
            if (/^#{1,3}\s/.test(line)) { inSummary = false; }
            else summaryLines.push(line.replace(/^[*\-•]\s*/, '').trim());
        }
    }
    info.summary = summaryLines.slice(0, 3).join(' ').substring(0, 300);

    // Generate suggested email bullet points from the resume
    const bullets = [];
    if (info.skills.length > 0) bullets.push(`💻 Strong skills in: **${info.skills.slice(0, 6).join(', ')}**`);
    if (info.experience.length > 0) bullets.push(`💼 Proven experience: ${info.experience[0].substring(0, 100)}`);
    if (info.education.length > 0) bullets.push(`🎓 ${info.education[0].substring(0, 100)}`);
    if (info.projects.length > 0) bullets.push(`🚀 Projects: ${info.projects[0].substring(0, 100)}`);
    if (info.summary) bullets.push(`✨ ${info.summary.substring(0, 120)}`);
    info.suggestedBullets = bullets.filter(b => b.length > 5);

    return info;
}

/**
 * Generate a custom email template based on extracted resume info
 */
function generateEmailTemplate(info, position = 'a suitable role') {
    const skillList = info.skills.slice(0, 6).join(', ') || 'various technologies';
    const name = info.name || 'Suraj Choudhari';
    const emailAddr = info.email || 'surajorg47@gmail.com';

    let experienceBlock = '';
    if (info.experience.length > 0) {
        const topExp = info.experience.slice(0, 3).map(e => `* ${e.substring(0, 100)}`).join('\n');
        experienceBlock = `\n**Professional Highlights:**\n${topExp}\n`;
    }

    let projectBlock = '';
    if (info.projects.length > 0) {
        projectBlock = `\n**Key Projects:**\n* ${info.projects.slice(0, 2).map(p => p.substring(0, 100)).join('\n* ')}\n`;
    }

    return `Hi {{hr_name | "Hiring Team"}},

I hope you are doing well!

My name is **${name}**, a passionate software professional with hands-on expertise in **${skillList}**.

I am reaching out to express my strong interest in **{{position | "${position}"}}** at **{{company_name}}**. Your organization's work truly stands out, and I believe my background aligns well with your team's goals.${info.summary ? '\n\n' + info.summary : ''}
${experienceBlock}**What I bring to the table:**
* 💻 Technical proficiency: **${skillList}**
${info.education.length > 0 ? `* 🎓 ${info.education[0].substring(0, 80)}\n` : ''}${info.projects.length > 0 ? `* 🚀 Built projects including: ${info.projects[0].substring(0, 80)}\n` : ''}* 🤝 Strong teamwork, communication, and problem-solving skills
${projectBlock}
I have attached my **resume** for your reference and would love to discuss how I can contribute to **{{company_name}}**.

Looking forward to hearing from you!

Best regards,
**{{applicant_name | "${name}"}}**
📧 {{applicant_email | "${emailAddr}"}}${info.phone ? '\n📞 ' + info.phone : ''}${info.linkedin ? '\n🔗 ' + info.linkedin : ''}${info.github ? '\n💻 ' + info.github : ''}`;
}

module.exports = { parseResume, extractResumeInfo, generateEmailTemplate };
