// STYLE-02A title art. Flat-colour dusk mountain city, drawn as vectors so the
// title and intro share one definition and crop cleanly at any viewport.
// The copy column sits over the left half, so the street life stays right of
// centre. No real place names or shop brands are drawn.
export function titleStreetSvg(prefix:string):string{
  const p=prefix;
  let far='';
  const towers:Array<[number,number,number,number]>=[
    [60,86,168,0], [156,64,118,1], [252,78,210,0], [366,58,142,1], [452,92,236,0],
    [566,70,150,1], [668,60,188,0], [760,84,128,1], [878,66,206,0], [972,58,150,1],
    [1086,88,228,0], [1200,62,166,1], [1302,82,244,0], [1410,58,152,1], [1502,96,196,0],
  ];
  for(const [x,w,h,tone]of towers){
    far+=`<rect x="${x}" y="${600-h}" width="${w}" height="${h}" rx="2" fill="${tone?'#2a4147':'#22373d'}"/>`;
    far+=`<rect x="${x}" y="${600-h}" width="${w}" height="3" fill="#8fa7a4" opacity=".22"/>`;
    for(let wy=600-h+14;wy<588;wy+=22){
      for(let wx=x+9;wx<x+w-9;wx+=17){
        if((wx*3+wy*5)%7<2)far+=`<rect x="${wx}" y="${wy}" width="5" height="7" rx="1" fill="#f8d596" opacity="${0.18+((wx+wy)%3)*0.07}"/>`;
      }
    }
  }
  return `<svg class="exp-title-art-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${p}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b191c"/>
      <stop offset=".38" stop-color="#182e32"/>
      <stop offset=".58" stop-color="#33474a"/>
      <stop offset=".74" stop-color="#7d5a45"/>
      <stop offset=".86" stop-color="#c07f50"/>
      <stop offset="1" stop-color="#8a5c46"/>
    </linearGradient>
    <radialGradient id="${p}-sun" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#f8d596" stop-opacity=".62"/>
      <stop offset=".45" stop-color="#e9a65d" stop-opacity=".26"/>
      <stop offset="1" stop-color="#e9a65d" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${p}-lamp" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffd79a" stop-opacity=".55"/>
      <stop offset=".5" stop-color="#f8c47c" stop-opacity=".18"/>
      <stop offset="1" stop-color="#f8c47c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${p}-haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fa7a0" stop-opacity="0"/>
      <stop offset=".55" stop-color="#a89a86" stop-opacity=".18"/>
      <stop offset="1" stop-color="#d9a06a" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${p}-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d6c6a5"/>
      <stop offset="1" stop-color="#ab9674"/>
    </linearGradient>
    <linearGradient id="${p}-glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe1a8" stop-opacity=".92"/>
      <stop offset="1" stop-color="#d98a4f" stop-opacity=".72"/>
    </linearGradient>
    <linearGradient id="${p}-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#41504c"/>
      <stop offset=".55" stop-color="#344342"/>
      <stop offset="1" stop-color="#223130"/>
    </linearGradient>
    <linearGradient id="${p}-vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1718" stop-opacity="0"/>
      <stop offset=".7" stop-color="#0b1718" stop-opacity=".12"/>
      <stop offset="1" stop-color="#0b1718" stop-opacity=".52"/>
    </linearGradient>
  </defs>

  <rect width="1600" height="1000" fill="url(#${p}-sky)"/>
  <circle cx="1208" cy="512" r="450" fill="url(#${p}-sun)"/>
  <rect y="300" width="1600" height="330" fill="url(#${p}-haze)"/>

  <!-- far ridge, then the receding city -->
  <path d="M0 556 L0 486 Q120 458 236 492 T472 468 T720 502 T968 474 T1204 500 T1428 472 T1600 492 L1600 640 L0 640Z" fill="#203538" opacity=".92"/>
  <path d="M0 588 L0 528 Q150 508 296 532 T596 512 T884 540 T1160 516 T1440 536 T1600 520 L1600 664 L0 664Z" fill="#1a2d31" opacity=".95"/>
  ${far}

  <!-- light rail crossing the slope -->
  <g>
    <rect x="356" y="586" width="756" height="16" rx="3" fill="#172a2d"/>
    <rect x="356" y="586" width="756" height="3" fill="#54706e" opacity=".55"/>
    <rect x="392" y="602" width="9" height="76" fill="#1d3134"/>
    <rect x="560" y="602" width="9" height="88" fill="#1d3134"/>
    <rect x="742" y="602" width="9" height="96" fill="#1d3134"/>
    <rect x="924" y="602" width="9" height="90" fill="#1d3134"/>
    <rect x="1062" y="602" width="9" height="74" fill="#1d3134"/>
    <g>
      <rect x="608" y="558" width="322" height="30" rx="13" fill="#2c474b"/>
      <rect x="616" y="562" width="306" height="13" rx="6" fill="#f8d596" opacity=".8"/>
      <rect x="616" y="562" width="306" height="4" rx="2" fill="#ffe9bd" opacity=".7"/>
      <circle cx="924" cy="574" r="4.5" fill="#ffe6b4"/>
      <rect x="608" y="572" width="322" height="3" fill="#132427" opacity=".6"/>
    </g>
    <path d="M420 558 L1060 558" stroke="#6e8a86" stroke-width="1.4" opacity=".4"/>
  </g>

  <!-- stepped hillside: retaining walls, terraces and stacked homes -->
  <g>
    <path d="M0 640 L0 596 L120 596 L120 612 L248 612 L248 634 L392 634 L392 616 L540 616 L540 640Z" fill="#2a4443"/>
    <path d="M0 700 L0 640 L196 640 L196 658 L356 658 L356 648 L520 648 L520 676 L664 676 L664 700Z" fill="#253d3e"/>
    <rect x="0" y="700" width="706" height="128" fill="#2c4544"/>
    <path d="M0 718 L706 718 M0 744 L706 744 M0 770 L706 770 M0 796 L706 796" stroke="#203635" stroke-width="2" opacity=".8"/>
    <rect x="0" y="700" width="706" height="5" fill="#68827a" opacity=".5"/>

    <g>
      <rect x="34" y="540" width="132" height="104" fill="url(#${p}-wall)"/>
      <path d="M22 542 L88 504 L154 542Z" fill="#263e40"/>
      <rect x="34" y="540" width="132" height="6" fill="#e6d4ae" opacity=".6"/>
      <rect x="54" y="566" width="26" height="32" fill="#f8d596" opacity=".75"/>
      <rect x="96" y="566" width="26" height="32" fill="#3d5352" opacity=".7"/>
      <rect x="142" y="566" width="12" height="48" fill="#31484a"/>
    </g>
    <g>
      <rect x="196" y="508" width="158" height="132" fill="#c9b795"/>
      <rect x="186" y="500" width="178" height="12" fill="#253d3f"/>
      <rect x="202" y="530" width="38" height="44" fill="#2f4749"/>
      <rect x="250" y="530" width="38" height="44" fill="#f8d596" opacity=".7"/>
      <rect x="298" y="530" width="38" height="44" fill="#2f4749"/>
      <rect x="202" y="590" width="38" height="38" fill="#f8d596" opacity=".55"/>
      <rect x="250" y="590" width="38" height="38" fill="#334b4c"/>
      <rect x="298" y="590" width="38" height="38" fill="#f8d596" opacity=".68"/>
      <rect x="350" y="512" width="10" height="128" fill="#253b3d"/>
    </g>
    <g>
      <rect x="394" y="566" width="134" height="112" fill="#bfae8e"/>
      <path d="M384 568 L461 534 L538 568Z" fill="#223a3c"/>
      <rect x="410" y="600" width="30" height="30" fill="#f8d596" opacity=".72"/>
      <rect x="454" y="600" width="30" height="30" fill="#334b4c"/>
      <rect x="498" y="600" width="20" height="54" fill="#2d4446"/>
      <rect x="410" y="646" width="30" height="24" fill="#334b4c"/>
      <rect x="454" y="646" width="30" height="24" fill="#f8d596" opacity=".6"/>
    </g>
    <g>
      <rect x="0" y="628" width="120" height="76" fill="#b7a585"/>
      <rect x="12" y="650" width="26" height="28" fill="#f8d596" opacity=".55"/>
      <rect x="56" y="650" width="26" height="28" fill="#31484a"/>
      <rect x="536" y="676" width="128" height="74" fill="#c2b190"/>
      <rect x="552" y="694" width="28" height="28" fill="#f8d596" opacity=".62"/>
      <rect x="596" y="694" width="28" height="28" fill="#30494a"/>
      <rect x="640" y="694" width="14" height="42" fill="#2c4446"/>
    </g>
    <path d="M300 762 L300 828 L352 828 L352 762Z" fill="#22393a"/>
    <path d="M308 828 L308 772 L344 772 L344 828" fill="none" stroke="#7f958c" stroke-width="2" opacity=".5"/>
    <path d="M300 792 L352 792 M300 812 L352 812" stroke="#7f958c" stroke-width="1.4" opacity=".35"/>

    <!-- stairs down to the near street, with a handrail -->
    <g>
      <path d="M620 760 L760 760 L760 1000 L520 1000 Z" fill="#3a4a47"/>
      <path d="M640 784 L748 784 M632 812 L756 812 M624 840 L764 840 M616 868 L772 868 M608 896 L780 896 M600 924 L788 924 M592 952 L796 952 M584 980 L804 980" stroke="#283838" stroke-width="7"/>
      <path d="M760 760 L760 1000" stroke="#1d2e2f" stroke-width="5"/>
      <path d="M760 760 L760 1000" stroke="#6f8982" stroke-width="2" opacity=".4"/>
      <path d="M628 760 L628 862" stroke="#3f5350" stroke-width="6"/>
      <path d="M628 760 L628 862" stroke="#a78457" stroke-width="2" opacity=".65"/>
    </g>
  </g>

  <!-- the shop row on the right, street level -->
  <g>
    <rect x="1036" y="548" width="342" height="322" fill="url(#${p}-wall)"/>
    <rect x="1026" y="536" width="362" height="16" rx="3" fill="#21383a"/>
    <rect x="1036" y="548" width="342" height="4" fill="#e9d7b0" opacity=".7"/>
    <rect x="1052" y="572" width="52" height="60" fill="#f8d596" opacity=".7"/>
    <rect x="1118" y="572" width="52" height="60" fill="#2e4648"/>
    <rect x="1184" y="572" width="52" height="60" fill="#f8d596" opacity=".5"/>
    <rect x="1250" y="572" width="52" height="60" fill="#2e4648"/>
    <rect x="1316" y="572" width="30" height="128" fill="#283f41"/>
    <rect x="1052" y="656" width="52" height="54" fill="#2e4648"/>
    <rect x="1118" y="656" width="52" height="54" fill="#f8d596" opacity=".62"/>
    <rect x="1184" y="656" width="52" height="54" fill="#2e4648"/>
    <rect x="1250" y="656" width="52" height="54" fill="#f8d596" opacity=".8"/>
    <path d="M1074 534 L1156 534 L1156 560 L1074 560Z" fill="#d4553d" opacity=".9"/>
    <rect x="1082" y="540" width="66" height="5" rx="2" fill="#f2e8d5" opacity=".9"/>
    <rect x="1082" y="549" width="46" height="4" rx="2" fill="#f2e8d5" opacity=".65"/>

    <!-- warm shopfront: glass, awning and door -->
    <rect x="1044" y="752" width="318" height="118" fill="#182b2e"/>
    <rect x="1056" y="764" width="196" height="94" fill="url(#${p}-glass)"/>
    <rect x="1064" y="772" width="84" height="78" fill="#ffe9bd" opacity=".3"/>
    <rect x="1160" y="772" width="84" height="78" fill="#f8d596" opacity=".22"/>
    <rect x="1056" y="812" width="196" height="3" fill="#9c5a38" opacity=".55"/>
    <path d="M1038 754 L1368 754 L1352 780 L1054 780Z" fill="#3f6f66"/>
    <path d="M1038 754 L1368 754 L1368 760 L1038 760Z" fill="#7fb3a4" opacity=".55"/>
    <rect x="1268" y="764" width="82" height="100" fill="#22383a"/>
    <rect x="1278" y="774" width="62" height="82" fill="#f8d596" opacity=".68"/>
    <rect x="1306" y="816" width="4" height="34" fill="#173033"/>
    <rect x="1028" y="876" width="352" height="10" rx="2" fill="#202f30"/>
    <rect x="1028" y="876" width="352" height="3" fill="#8b7f68" opacity=".7"/>

    <rect x="1392" y="620" width="208" height="252" fill="#b3a284"/>
    <rect x="1384" y="610" width="216" height="12" fill="#1f3537"/>
    <rect x="1408" y="642" width="42" height="46" fill="#2e4648"/>
    <rect x="1464" y="642" width="42" height="46" fill="#f8d596" opacity=".55"/>
    <rect x="1520" y="642" width="42" height="46" fill="#2e4648"/>
    <rect x="1408" y="704" width="42" height="46" fill="#f8d596" opacity=".7"/>
    <rect x="1464" y="704" width="42" height="46" fill="#2e4648"/>
    <rect x="1520" y="704" width="42" height="46" fill="#f8d596" opacity=".42"/>
    <rect x="1400" y="780" width="188" height="90" fill="#1b2f32"/>
    <rect x="1414" y="792" width="160" height="66" fill="#e0a05f" opacity=".5"/>
  </g>

  <!-- ground plane and paving joints -->
  <path d="M0 760 L1600 760 L1600 1000 L0 1000Z" fill="url(#${p}-ground)"/>
  <path d="M0 802 L1600 780 M0 856 L1600 834 M0 916 L1600 892" stroke="#22302f" stroke-width="3" opacity=".7"/>
  <path d="M0 802 L1600 780 M0 856 L1600 834" stroke="#6c7f76" stroke-width="1" opacity=".22"/>
  <path d="M86 760 L64 1000 M212 760 L206 1000 M338 760 L348 1000 M464 760 L490 1000 M590 760 L632 1000 M716 760 L774 1000 M842 760 L916 1000 M968 760 L1058 1000 M1094 760 L1200 1000 M1220 760 L1342 1000 M1346 760 L1484 1000 M1472 760 L1600 962" stroke="#263533" stroke-width="2" opacity=".55"/>

  <!-- trees and lamps -->
  <g>
    <path d="M232 846 L232 760" stroke="#3b3226" stroke-width="10"/>
    <ellipse cx="214" cy="736" rx="58" ry="44" fill="#2f5247"/>
    <ellipse cx="272" cy="754" rx="48" ry="36" fill="#28463d"/>
    <ellipse cx="238" cy="702" rx="44" ry="32" fill="#3a6354"/>
    <path d="M202 716 Q226 690 252 706" stroke="#b98a58" stroke-width="4" opacity=".5" fill="none"/>
    <path d="M900 858 L900 782" stroke="#3b3226" stroke-width="9"/>
    <ellipse cx="884" cy="760" rx="44" ry="34" fill="#2c4c43"/>
    <ellipse cx="928" cy="774" rx="38" ry="28" fill="#254139"/>
    <ellipse cx="902" cy="732" rx="32" ry="24" fill="#38604f"/>
    <path d="M878 744 Q896 724 916 736" stroke="#b98a58" stroke-width="3" opacity=".5" fill="none"/>
    <path d="M1552 872 L1552 792" stroke="#3b3226" stroke-width="10"/>
    <ellipse cx="1532" cy="766" rx="52" ry="40" fill="#2f5247"/>
    <ellipse cx="1586" cy="782" rx="44" ry="34" fill="#28463d"/>
    <ellipse cx="1558" cy="736" rx="38" ry="28" fill="#3a6354"/>
  </g>

  <g>
    <circle cx="726" cy="828" r="118" fill="url(#${p}-lamp)"/>
    <rect x="722" y="838" width="7" height="104" fill="#1b2c2e"/>
    <rect x="712" y="936" width="27" height="7" rx="2" fill="#1b2c2e"/>
    <path d="M726 838 Q726 820 744 820 L752 820" stroke="#203437" stroke-width="6" fill="none"/>
    <circle cx="754" cy="820" r="7" fill="#ffd79a"/>
    <circle cx="754" cy="820" r="13" fill="#ffd79a" opacity=".28"/>

    <circle cx="1446" cy="806" r="104" fill="url(#${p}-lamp)"/>
    <rect x="1442" y="814" width="7" height="96" fill="#1b2c2e"/>
    <rect x="1432" y="904" width="27" height="7" rx="2" fill="#1b2c2e"/>
    <path d="M1446 814 Q1446 796 1428 796 L1420 796" stroke="#203437" stroke-width="6" fill="none"/>
    <circle cx="1418" cy="796" r="7" fill="#ffd79a"/>
    <circle cx="1418" cy="796" r="13" fill="#ffd79a" opacity=".28"/>

    <circle cx="1194" cy="850" r="96" fill="url(#${p}-lamp)"/>
  </g>

  <!-- two passers-by, small against the street -->
  <g opacity=".92">
    <ellipse cx="836" cy="952" rx="26" ry="7" fill="#0b1718" opacity=".45"/>
    <rect x="828" y="902" width="11" height="44" rx="4" fill="#24393b"/>
    <path d="M824 906 L843 906 L847 936 L820 936Z" fill="#3d5e59"/>
    <circle cx="834" cy="894" r="10" fill="#c99a7d"/>
    <circle cx="838" cy="893" r="2" fill="#241d1a"/><circle cx="846" cy="893" r="2" fill="#241d1a"/>
    <path d="M824 896 Q832 884 843 888" stroke="#2b2320" stroke-width="5" fill="none"/>
    <rect x="816" y="910" width="7" height="26" rx="3" fill="#4f8a7e"/>

    <ellipse cx="1364" cy="966" rx="30" ry="8" fill="#0b1718" opacity=".45"/>
    <rect x="1356" y="908" width="12" height="48" rx="4" fill="#203436"/>
    <path d="M1350 912 L1374 912 L1378 946 L1348 946Z" fill="#6b4a3c"/>
    <circle cx="1362" cy="898" r="11" fill="#d3a486"/>
    <circle cx="1358" cy="897" r="2" fill="#241d1a"/><circle cx="1367" cy="897" r="2" fill="#241d1a"/>
    <path d="M1352 900 Q1362 888 1373 892" stroke="#2b2320" stroke-width="5" fill="none"/>
    <rect x="1374" y="916" width="8" height="28" rx="3" fill="#8a5a3e"/>
  </g>

  <!-- protagonist: teal coat, camera, one backpack, 3/4 front -->
  <g>
    <ellipse cx="1122" cy="934" rx="38" ry="10" fill="#0b1718" opacity=".5"/>
    <ellipse cx="1122" cy="932" rx="26" ry="6" fill="#0b1718" opacity=".55"/>
    <rect x="1102" y="862" width="14" height="64" rx="6" fill="#24383b"/>
    <rect x="1128" y="862" width="14" height="64" rx="6" fill="#203336"/>
    <rect x="1098" y="918" width="22" height="11" rx="4" fill="#18292c"/>
    <rect x="1126" y="918" width="22" height="11" rx="4" fill="#18292c"/>
    <path d="M1092 806 L1148 806 L1154 884 L1086 884Z" fill="#4f8a7e"/>
    <path d="M1148 806 L1154 884 L1124 884 L1124 806Z" fill="#3b6a60" opacity=".9"/>
    <path d="M1086 884 L1154 884 L1152 894 L1088 894Z" fill="#3b6a60"/>
    <rect x="1090" y="814" width="11" height="58" rx="5" fill="#457c71"/>
    <rect x="1142" y="814" width="11" height="58" rx="5" fill="#3b6a60"/>
    <circle cx="1096" cy="876" r="6" fill="#d9a889"/>
    <circle cx="1147" cy="876" r="6" fill="#c99a7d"/>
    <rect x="1114" y="790" width="15" height="18" fill="#c99a7d"/>
    <ellipse cx="1121" cy="770" rx="22" ry="24" fill="#d9a889"/>
    <path d="M1098 766 Q1100 738 1123 738 Q1146 738 1148 766 Q1138 754 1122 754 Q1106 754 1098 766Z" fill="#2b2320"/>
    <path d="M1098 766 Q1090 776 1094 790 Q1100 776 1105 768Z" fill="#2b2320"/>
    <circle cx="1112" cy="772" r="2.6" fill="#241d1a"/>
    <circle cx="1130" cy="771" r="2.4" fill="#241d1a"/>
    <path d="M1107 764 Q1112 761 1117 764" stroke="#5a4232" stroke-width="1.6" fill="none"/>
    <path d="M1125 763 Q1130 760 1135 763" stroke="#5a4232" stroke-width="1.6" fill="none"/>
    <path d="M1120 776 Q1118 780 1121 781" stroke="#b88366" stroke-width="1.6" fill="none"/>
    <path d="M1113 787 Q1122 790 1131 786" stroke="#9c604c" stroke-width="1.8" fill="none"/>
    <path d="M1121 796 L1121 806" stroke="#b88366" stroke-width="2"/>
    <!-- backpack, one only, slung on the left -->
    <rect x="1080" y="812" width="18" height="42" rx="6" fill="#8a5a3e"/>
    <rect x="1083" y="818" width="12" height="29" rx="4" fill="#6f452f"/>
    <path d="M1098 814 Q1102 828 1098 850" stroke="#5f3d2b" stroke-width="3" fill="none"/>
    <!-- camera at the chest -->
    <rect x="1110" y="834" width="25" height="16" rx="4" fill="#223033"/>
    <circle cx="1122" cy="842" r="6" fill="#9ed4c8"/>
    <circle cx="1122" cy="842" r="2.6" fill="#1a2b2e"/>
    <path d="M1114 834 Q1122 826 1131 834" stroke="#1b2a2c" stroke-width="2.4" fill="none"/>
  </g>

  <rect width="1600" height="1000" fill="url(#${p}-vignette)"/>
</svg>`;
}
