var ConfigCustomTelegramSet;(()=>{"use strict";var z={23009:(n,l,s)=>{var u={"./Components":()=>Promise.all([s.e("webpack_sharing_consume_default_react_react"),s.e("webpack_sharing_consume_default_prop-types_prop-types"),s.e("webpack_sharing_consume_default_iobroker_adapter-react-v5_iobroker_adapter-react-v5-webpack_s-344585"),s.e("src_Components_jsx")]).then(()=>()=>s(92094))},f=(d,g)=>(s.R=g,g=s.o(u,d)?u[d]():Promise.resolve().then(()=>{throw new Error('Module "'+d+'" does not exist in container.')}),s.R=void 0,g),v=(d,g)=>{if(s.S){var m="default",y=s.S[m];if(y&&y!==d)throw new Error("Container initialization failed as it has already been initialized with a different share scope");return s.S[m]=d,s.I(m,g)}};s.d(l,{get:()=>f,init:()=>v})}},O={};function e(n){var l=O[n];if(l!==void 0)return l.exports;var s=O[n]={id:n,loaded:!1,exports:{}};return z[n].call(s.exports,s,s.exports,e),s.loaded=!0,s.exports}e.m=z,e.c=O,e.amdD=function(){throw new Error("define cannot be used indirect")},e.n=n=>{var l=n&&n.__esModule?()=>n.default:()=>n;return e.d(l,{a:l}),l},e.d=(n,l)=>{for(var s in l)e.o(l,s)&&!e.o(n,s)&&Object.defineProperty(n,s,{enumerable:!0,get:l[s]})},e.f={},e.e=n=>Promise.all(Object.keys(e.f).reduce((l,s)=>(e.f[s](n,l),l),[])),e.u=n=>"static/js/"+n+"."+{"vendors-node_modules_mui_material_styles_styled_js-node_modules_mui_material_styles_useThemeP-5ae56a":"55d823ad","vendors-node_modules_mui_material_colors_index_js-node_modules_mui_material_styles_index_js-n-119afd":"d4caa9dd","vendors-node_modules_mui_material_Button_Button_js-node_modules_mui_material_Checkbox_index_j-3af11e":"9a15c374","vendors-node_modules_iobroker_adapter-react-v5_GenericApp_js":"4f45923e","vendors-node_modules_iobroker_adapter-react-v5_assets_devices_parseNames_d_ts-node_modules_io-1d9f06":"05d089cd",webpack_sharing_consume_default_react_react:"dbf809cc","webpack_sharing_consume_default_prop-types_prop-types":"a742cf33","webpack_sharing_consume_default_react-dom_react-dom":"5f4509c2","webpack_sharing_consume_default_iobroker_adapter-react-v5_iobroker_adapter-react-v5-webpack_s-344585":"d6a561be","node_modules_iobroker_adapter-react-v5_assets_devices_sync_recursive_-node_modules_iobroker_a-b694110":"cecb317a","vendors-node_modules_mui_icons-material_esm_index_js":"53a98594","vendors-node_modules_mui_material_index_js":"22278a4a","vendors-node_modules_mui_styles_withStyles_withStyles_js":"cc25992a","vendors-node_modules_mui_styles_index_js-node_modules_mui_utils_capitalize_capitalize_js-node-bfcaa8":"0760079f","node_modules_prop-types_index_js":"6da256b6","vendors-node_modules_react-dom_index_js":"f8dda1f6",node_modules_react_index_js:"70ac611b",src_Components_jsx:"39bd6057","node_modules_iobroker_adapter-react-v5_assets_devices_sync_recursive_-node_modules_iobroker_a-b694111":"31c3460d"}[n]+".chunk.js",e.miniCssF=n=>{},e.g=function(){if(typeof globalThis=="object")return globalThis;try{return this||new Function("return this")()}catch(n){if(typeof window=="object")return window}}(),e.o=(n,l)=>Object.prototype.hasOwnProperty.call(n,l),(()=>{var n={},l="iobroker-admin-component-telegram:";e.l=(s,u,f,v)=>{if(n[s]){n[s].push(u);return}var d,g;if(f!==void 0)for(var m=document.getElementsByTagName("script"),y=0;y<m.length;y++){var p=m[y];if(p.getAttribute("src")==s||p.getAttribute("data-webpack")==l+f){d=p;break}}d||(g=!0,d=document.createElement("script"),d.charset="utf-8",d.timeout=120,e.nc&&d.setAttribute("nonce",e.nc),d.setAttribute("data-webpack",l+f),d.src=s),n[s]=[u];var b=(C,k)=>{d.onerror=d.onload=null,clearTimeout(j);var x=n[s];if(delete n[s],d.parentNode&&d.parentNode.removeChild(d),x&&x.forEach(h=>h(k)),C)return C(k)},j=setTimeout(b.bind(null,void 0,{type:"timeout",target:d}),12e4);d.onerror=b.bind(null,d.onerror),d.onload=b.bind(null,d.onload),g&&document.head.appendChild(d)}})(),e.r=n=>{typeof Symbol!="undefined"&&Symbol.toStringTag&&Object.defineProperty(n,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(n,"__esModule",{value:!0})},e.nmd=n=>(n.paths=[],n.children||(n.children=[]),n),(()=>{e.S={};var n={},l={};e.I=(s,u)=>{u||(u=[]);var f=l[s];if(f||(f=l[s]={}),!(u.indexOf(f)>=0)){if(u.push(f),n[s])return n[s];e.o(e.S,s)||(e.S[s]={});var v=e.S[s],d=b=>{typeof console!="undefined"&&console.warn&&console.warn(b)},g="iobroker-admin-component-telegram",m=(b,j,C,k)=>{var x=v[b]=v[b]||{},h=x[j];(!h||!h.loaded&&(!k!=!h.eager?k:g>h.from))&&(x[j]={get:C,from:g,eager:!!k})},y=b=>{var j=h=>d("Initialization of sharing external failed: "+h);try{var C=e(b);if(!C)return;var k=h=>h&&h.init&&h.init(e.S[s],u);if(C.then)return p.push(C.then(k,j));var x=k(C);if(x&&x.then)return p.push(x.catch(j))}catch(h){j(h)}},p=[];switch(s){case"default":m("@iobroker/adapter-react-v5","4.13.24",()=>Promise.all([e.e("vendors-node_modules_mui_material_styles_styled_js-node_modules_mui_material_styles_useThemeP-5ae56a"),e.e("vendors-node_modules_mui_material_colors_index_js-node_modules_mui_material_styles_index_js-n-119afd"),e.e("vendors-node_modules_mui_material_Button_Button_js-node_modules_mui_material_Checkbox_index_j-3af11e"),e.e("vendors-node_modules_iobroker_adapter-react-v5_GenericApp_js"),e.e("vendors-node_modules_iobroker_adapter-react-v5_assets_devices_parseNames_d_ts-node_modules_io-1d9f06"),e.e("webpack_sharing_consume_default_react_react"),e.e("webpack_sharing_consume_default_prop-types_prop-types"),e.e("webpack_sharing_consume_default_react-dom_react-dom"),e.e("webpack_sharing_consume_default_iobroker_adapter-react-v5_iobroker_adapter-react-v5-webpack_s-344585"),e.e("node_modules_iobroker_adapter-react-v5_assets_devices_sync_recursive_-node_modules_iobroker_a-b694110")]).then(()=>()=>e(64620))),m("@mui/icons-material","5.15.18",()=>Promise.all([e.e("vendors-node_modules_mui_material_styles_styled_js-node_modules_mui_material_styles_useThemeP-5ae56a"),e.e("vendors-node_modules_mui_icons-material_esm_index_js"),e.e("webpack_sharing_consume_default_react_react"),e.e("webpack_sharing_consume_default_prop-types_prop-types")]).then(()=>()=>e(58597))),m("@mui/material","5.14.14",()=>Promise.all([e.e("vendors-node_modules_mui_material_styles_styled_js-node_modules_mui_material_styles_useThemeP-5ae56a"),e.e("vendors-node_modules_mui_material_colors_index_js-node_modules_mui_material_styles_index_js-n-119afd"),e.e("vendors-node_modules_mui_material_Button_Button_js-node_modules_mui_material_Checkbox_index_j-3af11e"),e.e("vendors-node_modules_mui_material_index_js"),e.e("webpack_sharing_consume_default_react_react"),e.e("webpack_sharing_consume_default_prop-types_prop-types"),e.e("webpack_sharing_consume_default_react-dom_react-dom")]).then(()=>()=>e(73224))),m("@mui/styles","5.14.14",()=>Promise.all([e.e("vendors-node_modules_mui_styles_withStyles_withStyles_js"),e.e("vendors-node_modules_mui_styles_index_js-node_modules_mui_utils_capitalize_capitalize_js-node-bfcaa8"),e.e("webpack_sharing_consume_default_react_react"),e.e("webpack_sharing_consume_default_prop-types_prop-types")]).then(()=>()=>e(92183))),m("prop-types","15.8.1",()=>e.e("node_modules_prop-types_index_js").then(()=>()=>e(75826))),m("react-dom","18.3.1",()=>Promise.all([e.e("vendors-node_modules_react-dom_index_js"),e.e("webpack_sharing_consume_default_react_react")]).then(()=>()=>e(22483))),m("react","18.3.1",()=>e.e("node_modules_react_index_js").then(()=>()=>e(77810)));break}return p.length?n[s]=Promise.all(p).then(()=>n[s]=1):n[s]=1}}})(),(()=>{var n;e.g.importScripts&&(n=e.g.location+"");var l=e.g.document;if(!n&&l&&(l.currentScript&&(n=l.currentScript.src),!n)){var s=l.getElementsByTagName("script");if(s.length)for(var u=s.length-1;u>-1&&(!n||!/^http(s?):/.test(n));)n=s[u--].src}if(!n)throw new Error("Automatic publicPath is not supported in this browser");n=n.replace(/#.*$/,"").replace(/\?.*$/,"").replace(/\/[^\/]+$/,"/"),e.p=n})(),(()=>{var n=t=>{var a=_=>_.split(".").map(i=>+i==i?+i:i),r=/^([^-+]+)?(?:-([^+]+))?(?:\+(.+))?$/.exec(t),o=r[1]?a(r[1]):[];return r[2]&&(o.length++,o.push.apply(o,a(r[2]))),r[3]&&(o.push([]),o.push.apply(o,a(r[3]))),o},l=(t,a)=>{t=n(t),a=n(a);for(var r=0;;){if(r>=t.length)return r<a.length&&(typeof a[r])[0]!="u";var o=t[r],_=(typeof o)[0];if(r>=a.length)return _=="u";var i=a[r],c=(typeof i)[0];if(_!=c)return _=="o"&&c=="n"||c=="s"||_=="u";if(_!="o"&&_!="u"&&o!=i)return o<i;r++}},s=t=>{var a=t[0],r="";if(t.length===1)return"*";if(a+.5){r+=a==0?">=":a==-1?"<":a==1?"^":a==2?"~":a>0?"=":"!=";for(var o=1,_=1;_<t.length;_++)o--,r+=(typeof(c=t[_]))[0]=="u"?"-":(o>0?".":"")+(o=2,c);return r}var i=[];for(_=1;_<t.length;_++){var c=t[_];i.push(c===0?"not("+w()+")":c===1?"("+w()+" || "+w()+")":c===2?i.pop()+" "+i.pop():s(c))}return w();function w(){return i.pop().replace(/^\((.+)\)$/,"$1")}},u=(t,a)=>{if(0 in t){a=n(a);var r=t[0],o=r<0;o&&(r=-r-1);for(var _=0,i=1,c=!0;;i++,_++){var w,M,P=i<t.length?(typeof t[i])[0]:"";if(_>=a.length||(M=(typeof(w=a[_]))[0])=="o")return!c||(P=="u"?i>r&&!o:P==""!=o);if(M=="u"){if(!c||P!="u")return!1}else if(c)if(P==M)if(i<=r){if(w!=t[i])return!1}else{if(o?w>t[i]:w<t[i])return!1;w!=t[i]&&(c=!1)}else if(P!="s"&&P!="n"){if(o||i<=r)return!1;c=!1,i--}else{if(i<=r||M<P!=o)return!1;c=!1}else P!="s"&&P!="n"&&(c=!1,i--)}}var A=[],V=A.pop.bind(A);for(_=1;_<t.length;_++){var B=t[_];A.push(B==1?V()|V():B==2?V()&V():B?u(B,a):!V())}return!!V()},f=(t,a)=>{var r=e.S[t];if(!r||!e.o(r,a))throw new Error("Shared module "+a+" doesn't exist in shared scope "+t);return r},v=(t,o)=>{var r=t[o],o=Object.keys(r).reduce((_,i)=>!_||l(_,i)?i:_,0);return o&&r[o]},d=(t,a)=>{var r=t[a];return Object.keys(r).reduce((o,_)=>!o||!r[o].loaded&&l(o,_)?_:o,0)},g=(t,a,r,o)=>"Unsatisfied version "+r+" from "+(r&&t[a][r].from)+" of shared singleton module "+a+" (required "+s(o)+")",m=(t,a,r,o)=>{var _=d(t,r);return h(t[r][_])},y=(t,a,r,o)=>{var _=d(t,r);return u(o,_)||k(g(t,r,_,o)),h(t[r][_])},p=(t,a,r,o)=>{var _=d(t,r);if(!u(o,_))throw new Error(g(t,r,_,o));return h(t[r][_])},b=(t,_,r)=>{var o=t[_],_=Object.keys(o).reduce((i,c)=>u(r,c)&&(!i||l(i,c))?c:i,0);return _&&o[_]},j=(t,a,r,o)=>{var _=t[r];return"No satisfying version ("+s(o)+") of shared module "+r+" found in shared scope "+a+`.
Available versions: `+Object.keys(_).map(i=>i+" from "+_[i].from).join(", ")},C=(t,a,r,o)=>{var _=b(t,r,o);if(_)return h(_);throw new Error(j(t,a,r,o))},k=t=>{typeof console!="undefined"&&console.warn&&console.warn(t)},x=(t,a,r,o)=>{k(j(t,a,r,o))},h=t=>(t.loaded=1,t.get()),S=t=>function(a,r,o,_){var i=e.I(a);return i&&i.then?i.then(t.bind(t,a,e.S[a],r,o,_)):t(a,e.S[a],r,o,_)},L=S((t,a,r)=>(f(t,r),h(v(a,r)))),D=S((t,a,r,o)=>a&&e.o(a,r)?h(v(a,r)):o()),U=S((t,a,r,o)=>(f(t,r),h(b(a,r,o)||x(a,t,r,o)||v(a,r)))),H=S((t,a,r)=>(f(t,r),m(a,t,r))),J=S((t,a,r,o)=>(f(t,r),y(a,t,r,o))),K=S((t,a,r,o)=>(f(t,r),C(a,t,r,o))),W=S((t,a,r,o)=>(f(t,r),p(a,t,r,o))),Q=S((t,a,r,o,_)=>!a||!e.o(a,r)?_():h(b(a,r,o)||x(a,t,r,o)||v(a,r))),R=S((t,a,r,o)=>!a||!e.o(a,r)?o():m(a,t,r)),T=S((t,a,r,o,_)=>!a||!e.o(a,r)?_():y(a,t,r,o)),X=S((t,a,r,o,_)=>{var i=a&&e.o(a,r)&&b(a,r,o);return i?h(i):_()}),Y=S((t,a,r,o,_)=>!a||!e.o(a,r)?_():p(a,t,r,o)),E={},N={28437:()=>T("default","react",[0],()=>e.e("node_modules_react_index_js").then(()=>()=>e(77810))),95973:()=>T("default","prop-types",[0],()=>e.e("node_modules_prop-types_index_js").then(()=>()=>e(75826))),23479:()=>T("default","react-dom",[0],()=>e.e("vendors-node_modules_react-dom_index_js").then(()=>()=>e(22483))),37449:()=>T("default","@iobroker/adapter-react-v5",[0],()=>Promise.all([e.e("vendors-node_modules_mui_material_styles_styled_js-node_modules_mui_material_styles_useThemeP-5ae56a"),e.e("vendors-node_modules_mui_material_colors_index_js-node_modules_mui_material_styles_index_js-n-119afd"),e.e("vendors-node_modules_mui_material_Button_Button_js-node_modules_mui_material_Checkbox_index_j-3af11e"),e.e("vendors-node_modules_iobroker_adapter-react-v5_GenericApp_js"),e.e("vendors-node_modules_iobroker_adapter-react-v5_assets_devices_parseNames_d_ts-node_modules_io-1d9f06"),e.e("webpack_sharing_consume_default_react-dom_react-dom"),e.e("node_modules_iobroker_adapter-react-v5_assets_devices_sync_recursive_-node_modules_iobroker_a-b694111")]).then(()=>()=>e(64620))),67085:()=>T("default","@mui/material",[0],()=>Promise.all([e.e("vendors-node_modules_mui_material_styles_styled_js-node_modules_mui_material_styles_useThemeP-5ae56a"),e.e("vendors-node_modules_mui_material_colors_index_js-node_modules_mui_material_styles_index_js-n-119afd"),e.e("vendors-node_modules_mui_material_Button_Button_js-node_modules_mui_material_Checkbox_index_j-3af11e"),e.e("vendors-node_modules_mui_material_index_js"),e.e("webpack_sharing_consume_default_react-dom_react-dom")]).then(()=>()=>e(73224))),70143:()=>T("default","@mui/styles",[0],()=>Promise.all([e.e("vendors-node_modules_mui_styles_withStyles_withStyles_js"),e.e("vendors-node_modules_mui_styles_index_js-node_modules_mui_utils_capitalize_capitalize_js-node-bfcaa8")]).then(()=>()=>e(92183))),21839:()=>T("default","@mui/icons-material",[0],()=>Promise.all([e.e("vendors-node_modules_mui_material_styles_styled_js-node_modules_mui_material_styles_useThemeP-5ae56a"),e.e("vendors-node_modules_mui_icons-material_esm_index_js")]).then(()=>()=>e(58597)))},$={webpack_sharing_consume_default_react_react:[28437],"webpack_sharing_consume_default_prop-types_prop-types":[95973],"webpack_sharing_consume_default_react-dom_react-dom":[23479],"webpack_sharing_consume_default_iobroker_adapter-react-v5_iobroker_adapter-react-v5-webpack_s-344585":[37449,67085,70143,21839]},F={};e.f.consumes=(t,a)=>{e.o($,t)&&$[t].forEach(r=>{if(e.o(E,r))return a.push(E[r]);if(!F[r]){var o=c=>{E[r]=0,e.m[r]=w=>{delete e.c[r],w.exports=c()}};F[r]=!0;var _=c=>{delete E[r],e.m[r]=w=>{throw delete e.c[r],c}};try{var i=N[r]();i.then?a.push(E[r]=i.then(o).catch(_)):o(i)}catch(c){_(c)}}})}})(),(()=>{var n={ConfigCustomTelegramSet:0};e.f.j=(u,f)=>{var v=e.o(n,u)?n[u]:void 0;if(v!==0)if(v)f.push(v[2]);else if(/^webpack_sharing_consume_default_(react(\-dom_react\-dom|_react)|iobroker_adapter\-react\-v5_iobroker_adapter\-react\-v5\-webpack_s\-344585|prop\-types_prop\-types)$/.test(u))n[u]=0;else{var d=new Promise((p,b)=>v=n[u]=[p,b]);f.push(v[2]=d);var g=e.p+e.u(u),m=new Error,y=p=>{if(e.o(n,u)&&(v=n[u],v!==0&&(n[u]=void 0),v)){var b=p&&(p.type==="load"?"missing":p.type),j=p&&p.target&&p.target.src;m.message="Loading chunk "+u+` failed.
(`+b+": "+j+")",m.name="ChunkLoadError",m.type=b,m.request=j,v[1](m)}};e.l(g,y,"chunk-"+u,u)}};var l=(u,f)=>{var v=f[0],d=f[1],g=f[2],m,y,p=0;if(v.some(j=>n[j]!==0)){for(m in d)e.o(d,m)&&(e.m[m]=d[m]);if(g)var b=g(e)}for(u&&u(f);p<v.length;p++)y=v[p],e.o(n,y)&&n[y]&&n[y][0](),n[y]=0},s=self.webpackChunkiobroker_admin_component_telegram=self.webpackChunkiobroker_admin_component_telegram||[];s.forEach(l.bind(null,0)),s.push=l.bind(null,s.push.bind(s))})(),e.nc=void 0;var G=e(23009);ConfigCustomTelegramSet=G})();

//# sourceMappingURL=customComponents.js.map