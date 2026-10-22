import { demoConfigs } from './demos/variants.mjs?v=fluid-3';

export const families = [
  { id: 'today', name: "Today's FTW", description: 'Familiar controls, clearer priorities. Compare the current interfaces with possible next steps.', ids: ['today-web','today-ios','cards-b','cards-c','study-13','ftw-focus','ftw-streams','ftw-ahead'] },
  { id: 'rings', name: 'Energy rings', description: 'A compact view of the whole home, built around the ring shared by a community member.', ids: ['community-ring','ring-quiet','ring-flow','ring-layers'] },
  { id: 'fluid', name: 'Fluid fields', description: 'Energy has volume and direction. Soft, connected surfaces show how much goes where.', ids: ['study-22','study-23','study-24','study-25','study-26','fluid-app','elastic-fields','finger-flow','site-flow','fused-fields'] },
  { id: 'home', name: 'Living home', description: 'The home becomes a place to explore, with a small companion and energy you can see.', ids: ['study-01','study-04','study-05','study-09','study-14'] },
  { id: 'time', name: 'Goals & time', description: 'Try new ways to understand a day, set a goal and see what happens next.', ids: ['study-02','study-03','study-06','study-07','study-08','study-10','study-11','study-12','study-15','study-16','study-17','study-18','study-19','study-20','study-21'] },
  { id: 'robots', name: 'Robot characters', description: 'Character studies for a companion that follows the interface. Vote on the robot itself here.', ids: ['robot-a','robot-b','robot-c'] }
];
export const demoIds = Object.keys(demoConfigs);
export const familyFor = id => families.find(f => f.ids.includes(id));
export const hasDemo = id => demoIds.includes(id);
export const kindFor = id => ['today-web','today-ios'].includes(id) ? 'Current interface' : id.startsWith('robot-') ? 'Character study' : id.startsWith('study-') ? 'Interaction idea' : 'App direction';
