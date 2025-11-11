const fs = require('fs');
const path = require('path');

// Read the questions.ts file
const questionsPath = path.join(__dirname, 'questions.ts');
const content = fs.readFileSync(questionsPath, 'utf-8');

// Count total questions by counting 'id:' occurrences (excluding the interface definition)
const idMatches = content.match(/^\s*id:\s*\d+/gm);
const totalQuestions = idMatches ? idMatches.length : 0;

// Extract domain and subdomain for each question
const questionBlocks = content.split(/(?=\s*\{\s*id:)/g).filter(block => block.includes('domain:'));

const domainCounts = {};
const subdomainCounts = {};

questionBlocks.forEach(block => {
    const domainMatch = block.match(/domain:\s*["']([^"']+)["']/);
    const subdomainMatch = block.match(/subdomain:\s*["']([^"']+)["']/);
    
    if (domainMatch) {
        const domain = domainMatch[1];
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
    
    if (subdomainMatch) {
        const subdomain = subdomainMatch[1];
        subdomainCounts[subdomain] = (subdomainCounts[subdomain] || 0) + 1;
    }
});

console.log('='.repeat(100));
console.log('GOOGLE CLOUD ASSOCIATE ENGINEER EXAM - QUESTION BANK ANALYSIS');
console.log('='.repeat(100));
console.log(`\nTotal Questions: ${totalQuestions}`);
console.log(`Questions needed to reach 500: ${500 - totalQuestions}\n`);

console.log('='.repeat(100));
console.log('DOMAIN DISTRIBUTION (Official 2025 Exam Structure)');
console.log('='.repeat(100));

const officialDomains = [
    { name: 'Setting up a cloud solution environment', target: 23, targetCount: 115 },
    { name: 'Planning and implementing a cloud solution', target: 30, targetCount: 150 },
    { name: 'Ensuring successful operation of a cloud solution', target: 28, targetCount: 140 },
    { name: 'Configuring access and security', target: 19, targetCount: 95 }
];

console.log('\nDomain                                                  Current   %     Target   %     Gap');
console.log('-'.repeat(100));

officialDomains.forEach(({ name, target, targetCount }) => {
    const current = domainCounts[name] || 0;
    const currentPct = ((current / totalQuestions) * 100).toFixed(1);
    const gap = targetCount - current;
    console.log(
        `${name.padEnd(55)} ${current.toString().padStart(4)} ${currentPct.padStart(5)}%   ${targetCount.toString().padStart(4)} ${target.toString().padStart(4)}%   ${gap.toString().padStart(4)}`
    );
});

console.log('\n' + '='.repeat(100));
console.log('TOP 20 SUBDOMAINS BY COVERAGE');
console.log('='.repeat(100));

const sortedSubdomains = Object.entries(subdomainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

sortedSubdomains.forEach(([subdomain, count]) => {
    console.log(`${subdomain.padEnd(80)} ${count.toString().padStart(4)}`);
});

console.log('\n' + '='.repeat(100));
console.log('EXPANSION SUMMARY');
console.log('='.repeat(100));

const totalGap = 500 - totalQuestions;
console.log(`\nCurrent: ${totalQuestions} questions`);
console.log(`Target:  500 questions`);
console.log(`Gap:     ${totalGap} questions needed\n`);

console.log('Domain-specific gaps:');
officialDomains.forEach(({ name, targetCount }) => {
    const current = domainCounts[name] || 0;
    const gap = targetCount - current;
    if (gap > 0) {
        console.log(`  • ${name}: +${gap} questions needed`);
    } else if (gap < 0) {
        console.log(`  • ${name}: ${Math.abs(gap)} questions over target (redistribute or keep)`);
    } else {
        console.log(`  • ${name}: ✓ Target met`);
    }
});

console.log('\n' + '='.repeat(100));
console.log('RECOMMENDATION');
console.log('='.repeat(100));
console.log(`
Based on the official 2025 Associate Cloud Engineer exam guide:

1. Priority Areas (Most Questions Needed):
   - Planning and implementing: Focus on compute, storage, networking
   - Ensuring successful operation: Focus on monitoring, logging, troubleshooting

2. Key Topics to Add (2025 Exam Focus):
   - Gemini Cloud Assist integration
   - GKE Autopilot operations
   - Cloud NGFW (Next Generation Firewall)
   - Database Center and Query Insights
   - Config Connector for IaC
   
3. Quality Standards:
   - Match Google's official sample question format
   - Scenario-based (not memorization)
   - 4 options per question
   - Detailed explanations for correct AND wrong answers

4. Suggested Batch Generation:
   - Generate 20-30 questions at a time
   - Verify against official exam guide topics
   - Ensure proper distribution across domains
`);

console.log('='.repeat(100));
