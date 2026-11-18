import { expect, it } from "vitest";
import { ExecutionBudget, executionFingerprint } from "./execution-budget";
it("allows more than four useful reads but bounds writes independently",()=>{
  const budget=new ExecutionBudget();
  for(let i=0;i<12;i++){budget.plan();const key=budget.beforeCall("read",{page:i},true);budget.afterRead(key,{rows:[i]});}
  expect(budget.canContinue()).toBe(true);
  for(let i=0;i<3;i++) budget.beforeCall("write",{id:i},false);
  expect(()=>budget.beforeCall("write",{id:4},false)).toThrow();
});
it("detects duplicate writes regardless of property order",()=>{
  const budget=new ExecutionBudget();
  budget.beforeCall("create",{a:1,b:2},false);
  expect(()=>budget.beforeCall("create",{b:2,a:1},false)).toThrow();
  expect(executionFingerprint("create",{b:2,a:1})).toBe(executionFingerprint("create",{a:1,b:2}));
});
it("stops repeated identical results but allows actual progress",()=>{
  const budget=new ExecutionBudget();
  const key=budget.beforeCall("read",{},true);
  budget.afterRead(key,{version:1});budget.afterRead(key,{version:2});
  expect(budget.canContinue()).toBe(true);
  budget.afterRead(key,{version:2});expect(budget.canContinue()).toBe(false);
});
it("uses a longer time budget only for background execution",()=>{
  let now=0;
  const interactive=new ExecutionBudget(false,()=>now),background=new ExecutionBudget(true,()=>now);
  now=90_001;expect(interactive.canContinue()).toBe(false);expect(background.canContinue()).toBe(true);
  now=480_001;expect(()=>background.beforeCall("read",{},true)).toThrow();
});
