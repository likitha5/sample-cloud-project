"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("@aws-cdk/assert");
const cdk = require("@aws-cdk/core");
const Awsdevhour = require("../lib/awsdevhour-stack");
test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Awsdevhour.AwsdevhourStack(app, 'MyTestStack');
    // THEN
    (0, assert_1.expect)(stack).to((0, assert_1.matchTemplate)({
        "Resources": {}
    }, assert_1.MatchStyle.EXACT));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzZGV2aG91ci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXdzZGV2aG91ci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNENBQWlGO0FBQ2pGLHFDQUFxQztBQUNyQyxzREFBc0Q7QUFFdEQsSUFBSSxDQUFDLGFBQWEsRUFBRSxHQUFHLEVBQUU7SUFDckIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsT0FBTztJQUNQLE1BQU0sS0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDakUsT0FBTztJQUNQLElBQUEsZUFBUyxFQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFBLHNCQUFhLEVBQUM7UUFDaEMsV0FBVyxFQUFFLEVBQUU7S0FDaEIsRUFBRSxtQkFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDekIsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBleHBlY3QgYXMgZXhwZWN0Q0RLLCBtYXRjaFRlbXBsYXRlLCBNYXRjaFN0eWxlIH0gZnJvbSAnQGF3cy1jZGsvYXNzZXJ0JztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCAqIGFzIEF3c2RldmhvdXIgZnJvbSAnLi4vbGliL2F3c2RldmhvdXItc3RhY2snO1xuXG50ZXN0KCdFbXB0eSBTdGFjaycsICgpID0+IHtcbiAgICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICAgIC8vIFdIRU5cbiAgICBjb25zdCBzdGFjayA9IG5ldyBBd3NkZXZob3VyLkF3c2RldmhvdXJTdGFjayhhcHAsICdNeVRlc3RTdGFjaycpO1xuICAgIC8vIFRIRU5cbiAgICBleHBlY3RDREsoc3RhY2spLnRvKG1hdGNoVGVtcGxhdGUoe1xuICAgICAgXCJSZXNvdXJjZXNcIjoge31cbiAgICB9LCBNYXRjaFN0eWxlLkVYQUNUKSlcbn0pO1xuIl19