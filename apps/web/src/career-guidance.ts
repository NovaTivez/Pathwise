import type { Career, Plan, Resource, Roadmap } from './ui'
export const careerChoices: Career[] = [
  {id:'cloud',name:'Cloud Engineer',description:'Cloud concepts, security, billing, and core services.',goal:'AWS Certified Cloud Practitioner',skills:['Cloud concepts','Security','Billing','Technology and services']},
  {id:'software',name:'Software Developer',description:'Programming, version control, web development, and testing.',goal:'Software development foundations',skills:['Programming','Version control','Web development','Testing']},
  {id:'data',name:'Data Analyst',description:'Spreadsheets, SQL, charts, and statistics.',goal:'Data analysis foundations',skills:['Spreadsheets','SQL','Data visualization','Statistics']},
  {id:'security',name:'Cybersecurity Analyst',description:'Networks, threats, and how systems are protected.',goal:'CompTIA Security+',skills:['Networking','Security','Threat analysis','Incident response']},
  {id:'support',name:'IT Support Specialist',description:'Hardware, operating systems, networks, and troubleshooting.',goal:'CompTIA A+',skills:['Hardware','Operating systems','Networking','Troubleshooting']},
  {id:'network',name:'Network Engineer',description:'Routing, network security, and automation.',goal:'Cisco CCNA',skills:['Networking','Routing','Network security','Automation']},
  {id:'undecided',name:'Undecided',description:'Free introductions before you pick a career.',goal:'Technology career foundations',skills:['Programming','Cloud concepts','Spreadsheets','Networking']},
]
export const certificationReferences = [
  {title:'AWS Certified Cloud Practitioner',careers:['cloud'],url:'https://aws.amazon.com/certification/certified-cloud-practitioner/'},
  {title:'Microsoft Azure Fundamentals (AZ-900)',careers:['cloud'],url:'https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/'},
  {title:'CompTIA A+',careers:['support'],url:'https://www.comptia.org/en-us/certifications/a/'},
  {title:'CompTIA Security+',careers:['security'],url:'https://www.comptia.org/en-us/certifications/security/'},
  {title:'Cisco CCNA',careers:['network'],url:'https://www.cisco.com/site/us/en/learn/training-certifications/certifications/enterprise/ccna/index.html'},
]
const freeIndexes: Record<string,{title:string;url:string}> = {
  cloud:{title:'Explore cloud concepts with Microsoft Learn',url:'https://learn.microsoft.com/en-us/training/azure/'},
  software:{title:'Learn web development with MDN',url:'https://developer.mozilla.org/en-US/docs/Learn_web_development'},
  data:{title:'Explore data learning paths with Microsoft Learn',url:'https://learn.microsoft.com/en-us/training/browse/?terms=data'},
  security:{title:'Explore security and networking with Cisco Networking Academy',url:'https://www.netacad.com/'},
  support:{title:'Explore IT foundations with Cisco Networking Academy',url:'https://www.netacad.com/'},
  network:{title:'Explore networking with Cisco Networking Academy',url:'https://www.netacad.com/'},
  undecided:{title:'Try a free introduction to web development',url:'https://developer.mozilla.org/en-US/docs/Learn_web_development'},
}
export function roadmapGuidance(plan: Plan, serverRoadmap?: Roadmap | null): Roadmap {
  const career=careerChoices.find(c=>c.id===(plan.career||'cloud'))||careerChoices[0],weeks=plan.timelineWeeks||12
  const gaps=career.skills.filter(s=>!plan.skills.includes(s))
  return {...(serverRoadmap||{decisions:[],outcome:'no_suitable_purchase',remainingStroops:(BigInt(plan.budgetStroops)-BigInt(plan.reserveStroops)).toString(),engine:'local-rule-based-guidance'}),gaps,career:career.name,timelineWeeks:weeks,steps:serverRoadmap?.steps||gaps.map((skill,i)=>({order:i+1,skill,weekStart:Math.floor(i*weeks/Math.max(1,gaps.length))+1,weekEnd:Math.max(1,Math.floor((i+1)*weeks/Math.max(1,gaps.length))),resourceIds:[],action:i===0&&!plan.skills.length?'Start with the basics for this skill.':'Practice this skill after the earlier steps.'})),freeResources:serverRoadmap?.freeResources||(!gaps.length?[]:[{resourceId:'reference-'+career.id,...freeIndexes[career.id],reason:serverRoadmap?.decisions.some(d=>d.state==='selected')?'A free reference to accompany your materials.':'Start here without committing any budget. Review optional paid offers separately.'}])}
}
export function resourceKind(resource:Resource) {return resource.kind==='certification-exam'?'Certification exam':resource.kind==='free-resource'||resource.priceStroops==='0'?'Free resource':resource.format==='lab'?'Hands-on lab':resource.format==='practice'?'Practice exam':'Prep course'}
export function exactStroops(value:string) {if(!/^\d+(\.\d{1,7})?$/.test(value))throw Error('Use a positive decimal with at most seven decimal places.');const [whole,part='']=value.split('.');return BigInt(whole)*10000000n+BigInt(part.padEnd(7,'0'))}
