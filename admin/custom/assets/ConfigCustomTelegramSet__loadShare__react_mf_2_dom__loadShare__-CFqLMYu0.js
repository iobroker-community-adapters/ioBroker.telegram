import{C as l}from"./ConfigCustomTelegramSet__loadShare__react__loadShare__-qT6HkOsG.js";import{_ as R,X as O,Y as k,a5 as w,a1 as z,a6 as L,a7 as X,a8 as J}from"./createTheme-BeniWjyR.js";import{j as T}from"./jsx-runtime-C7g9_nkN.js";import{g as q}from"./_commonjsHelpers-BosuxZz1.js";import{C as D,i as G}from"./ConfigCustomTelegramSet__mf_v__runtimeInit__mf_v__-J6gnGK7T.js";var P={exports:{}},r={};/** @license React v16.13.1
 * react-is.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var n=typeof Symbol=="function"&&Symbol.for,C=n?Symbol.for("react.element"):60103,x=n?Symbol.for("react.portal"):60106,y=n?Symbol.for("react.fragment"):60107,p=n?Symbol.for("react.strict_mode"):60108,d=n?Symbol.for("react.profiler"):60114,S=n?Symbol.for("react.provider"):60109,_=n?Symbol.for("react.context"):60110,E=n?Symbol.for("react.async_mode"):60111,v=n?Symbol.for("react.concurrent_mode"):60111,g=n?Symbol.for("react.forward_ref"):60112,b=n?Symbol.for("react.suspense"):60113,V=n?Symbol.for("react.suspense_list"):60120,h=n?Symbol.for("react.memo"):60115,$=n?Symbol.for("react.lazy"):60116,N=n?Symbol.for("react.block"):60121,W=n?Symbol.for("react.fundamental"):60117,Y=n?Symbol.for("react.responder"):60118,B=n?Symbol.for("react.scope"):60119;function a(e){if(typeof e=="object"&&e!==null){var t=e.$$typeof;switch(t){case C:switch(e=e.type,e){case E:case v:case y:case d:case p:case b:return e;default:switch(e=e&&e.$$typeof,e){case _:case g:case $:case h:case S:return e;default:return t}}case x:return t}}}function A(e){return a(e)===v}r.AsyncMode=E;r.ConcurrentMode=v;r.ContextConsumer=_;r.ContextProvider=S;r.Element=C;r.ForwardRef=g;r.Fragment=y;r.Lazy=$;r.Memo=h;r.Portal=x;r.Profiler=d;r.StrictMode=p;r.Suspense=b;r.isAsyncMode=function(e){return A(e)||a(e)===E};r.isConcurrentMode=A;r.isContextConsumer=function(e){return a(e)===_};r.isContextProvider=function(e){return a(e)===S};r.isElement=function(e){return typeof e=="object"&&e!==null&&e.$$typeof===C};r.isForwardRef=function(e){return a(e)===g};r.isFragment=function(e){return a(e)===y};r.isLazy=function(e){return a(e)===$};r.isMemo=function(e){return a(e)===h};r.isPortal=function(e){return a(e)===x};r.isProfiler=function(e){return a(e)===d};r.isStrictMode=function(e){return a(e)===p};r.isSuspense=function(e){return a(e)===b};r.isValidElementType=function(e){return typeof e=="string"||typeof e=="function"||e===y||e===v||e===d||e===p||e===b||e===V||typeof e=="object"&&e!==null&&(e.$$typeof===$||e.$$typeof===h||e.$$typeof===S||e.$$typeof===_||e.$$typeof===g||e.$$typeof===W||e.$$typeof===Y||e.$$typeof===B||e.$$typeof===N)};r.typeOf=a;P.exports=r;var H=P.exports,j=H,K={$$typeof:!0,render:!0,defaultProps:!0,displayName:!0,propTypes:!0},Q={$$typeof:!0,compare:!0,defaultProps:!0,displayName:!0,propTypes:!0,type:!0},F={};F[j.ForwardRef]=K;F[j.Memo]=Q;var M=function(t,s){var u=arguments;if(s==null||!L.call(s,"css"))return l.createElement.apply(void 0,u);var i=u.length,f=new Array(i);f[0]=X,f[1]=J(t,s);for(var o=2;o<i;o++)f[o]=u[o];return l.createElement.apply(null,f)};(function(e){var t;t||(t=e.JSX||(e.JSX={}))})(M||(M={}));var U=O(function(e,t){var s=e.styles,u=R([s],void 0,l.useContext(k)),i=l.useRef();return w(function(){var f=t.key+"-global",o=new t.sheet.constructor({key:f,nonce:t.sheet.nonce,container:t.sheet.container,speedy:t.sheet.isSpeedy}),m=!1,c=document.querySelector('style[data-emotion="'+f+" "+u.name+'"]');return t.sheet.tags.length&&(o.before=t.sheet.tags[0]),c!==null&&(m=!0,c.setAttribute("data-emotion",f),o.hydrate([c])),i.current=[o,m],function(){o.flush()}},[t]),w(function(){var f=i.current,o=f[0],m=f[1];if(m){f[1]=!1;return}if(u.next!==void 0&&z(t,u.next,!0),o.tags.length){var c=o.tags[o.tags.length-1].nextElementSibling;o.before=c,o.flush()}t.insert("",u,o,!1)},[t,u.name]),null});function Z(){for(var e=arguments.length,t=new Array(e),s=0;s<e;s++)t[s]=arguments[s];return R(t)}function ce(){var e=Z.apply(void 0,arguments),t="animation-"+e.name;return{name:t,styles:"@keyframes "+t+"{"+e.styles+"}",anim:1,toString:function(){return"_EMO_"+this.name+"_"+this.styles+"_EMO_"}}}function ee(e){return e==null||Object.keys(e).length===0}function me(e){const{styles:t,defaultTheme:s={}}=e,u=typeof t=="function"?i=>t(ee(i)?s:i):t;return T.jsx(U,{styles:u})}const ye=typeof window<"u"?l.useLayoutEffect:l.useEffect,I=l.createContext();function pe({value:e,...t}){return T.jsx(I.Provider,{value:e??!0,...t})}const de=()=>l.useContext(I)??!1,{loadShare:te}=G,{initPromise:re}=D,ne=re.then(e=>te("react-dom",{customShareInfo:{shareConfig:{singleton:!0,strictVersion:!1,requiredVersion:"*"}}})),oe=await ne.then(e=>e());var se=oe;const Se=q(se);export{se as C,me as G,Se as R,ye as a,pe as b,Z as c,ce as k,de as u};
