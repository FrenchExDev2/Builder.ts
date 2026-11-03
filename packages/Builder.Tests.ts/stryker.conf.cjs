/** Complete nonincremental campaign, including the generator. */
const path=require('node:path');
module.exports={
 testRunner:'vitest',plugins:[require.resolve('@stryker-mutator/vitest-runner')],
 mutate:['packages/Builder.ts/src/**/*.ts','!packages/Builder.ts/src/index.ts','!packages/Builder.ts/src/**/*.d.ts'],
 vitest:{configFile:'packages/Builder.Tests.ts/vitest.config.stryker.ts'},coverageAnalysis:'perTest',ignoreStatic:false,incremental:false,checkers:[],
 concurrency:Number(process.env.STRYKER_CONCURRENCY)||2,thresholds:{high:100,low:100,break:100},
 reporters:['html','json','clear-text','event-recorder'],
 jsonReporter:{fileName:`${process.env.STRYKER_REPORT_DIR??'test-results/mutation'}/mutation-report.json`},
 htmlReporter:{fileName:`${process.env.STRYKER_REPORT_DIR??'test-results/mutation'}/index.html`},
 eventReporter:{baseDir:`${process.env.STRYKER_REPORT_DIR??'test-results/mutation'}/events`},
 tempDirName:'packages/Builder.Tests.ts/.stryker-tmp',ignorePatterns:['**/.git/**','**/node_modules/**','**/test-results/**','**/.stryker-tmp/**','**/dist/**','.artifacts/**'],
};
