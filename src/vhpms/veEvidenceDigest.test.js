import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
test('browser-safe canonical evidence digest matches Node SHA256 including Unicode and padding boundaries',async()=>{
  const {evidenceDigest}=await import('./veEvidence.js')
  for(const value of [null,{},'abc','Zambia 🇿🇲',...Array.from({length:140},(_,i)=>'x'.repeat(i)),{z:[false,1,null],a:'value'}]){
    function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v)}
    assert.equal(evidenceDigest(value),createHash('sha256').update(canonical(value)).digest('hex'))
  }
})
