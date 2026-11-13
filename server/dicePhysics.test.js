
import test from 'node:test';
import assert from 'node:assert/strict';
import {rollPhysics} from './dicePhysics.js';
test('Cannon-es dice roll produces real visible faces for resource and combat throws',()=>{
 const two=rollPhysics(2,{vx:.4,vy:-.2,durationMs:320});
 assert.equal(two.length,2);
 assert.ok(two.every(n=>Number.isInteger(n)&&n>=1&&n<=6));
 const five=rollPhysics(5,{vx:100,vy:-100,durationMs:30000});
 assert.equal(five.length,5);
 assert.ok(five.every(n=>Number.isInteger(n)&&n>=1&&n<=6));
 assert.throws(()=>rollPhysics(0),/Dice count/);
});
