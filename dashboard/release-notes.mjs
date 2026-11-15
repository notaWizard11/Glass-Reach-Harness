import {readFile} from 'node:fs/promises';
export function parseReleaseNotes(markdown){
 const sections=[];let section=null;
 for(const line of markdown.split(/\r?\n/)){
  const heading=/^##\s+(.+)$/.exec(line);
  if(heading){section={title:heading[1].trim(),notes:[]};sections.push(section);continue;}
  const bullet=/^-\s+(.+)$/.exec(line);
  if(section&&bullet)section.notes.push(bullet[1].trim());
  else if(section&&/^\s+\S/.test(line)&&section.notes.length)section.notes[section.notes.length-1]+=' '+line.trim();
 }
 return sections;
}
export async function loadReleaseNotes(){
 const markdown=await readFile(new URL('../CHANGELOG.md',import.meta.url),'utf8');
 return {source:'/CHANGELOG.md',sections:parseReleaseNotes(markdown)};
}
