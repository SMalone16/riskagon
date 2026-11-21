export const CREWS={
 blue:{name:'Kingfishers',unit:'Outlaws',base:'Hideout',color:0x526b43,voice:'Dockside dispatch'},
 red:{name:'Kolt Group',unit:'Associates',base:'Abandoned Building',color:0xa76b37,voice:'Field report'},
 green:{name:'Final Chapter MC',unit:'Outlaws',base:'Clubhouse',color:0x202124,voice:'From the clubhouse'},
 yellow:{name:'San4San',unit:'Gangsters',base:'Trap House',color:0x7045ad,voice:'Block update'},
 purple:{name:'PTT Youngin$',unit:'Soldiers',base:'Hangout',color:0x17b8ad,voice:'Just dropped'},
 orange:{name:'Guardia Brothers',unit:'Mobsters',base:'Estate',color:0x743239,voice:'Family business'},
 teal:{name:'M7',unit:'Gangsters',base:'Compound',color:0xc4b9a5,voice:'Concrete journal'},
 ivory:{name:'La Polilla Negra',unit:'Soldiers',base:'Warehouse',color:0x164c55,voice:'Night shift'}
};
export const MATERIALS={wood:'Lumber',brick:'Aggregate',wheat:'Hardware',sheep:'Fiber',ore:'Concrete'};
export const PRODUCTS={rock:'Dice Rock',compound:'Dice Compound',dust:'Dice Dust',glue:'Dice Glue',dice:'Dice'};
export const SALES={1:500,2:1200,4:3000,8:10000};
export const SALES_GOAL=15000;
export const SITES={outpost:'Crew base',settlement:'Expanded base',barracks:'Recruitment office',mill:'Keyside Pulverizer',works:'Shoreline Binder Works',lab:'Dice Lab',dock:'Cargo Dock',hire:'Hire a member',boat:'Launch a skiff'};
export const PLANS={
 outpost:{cash:100,wood:1,ore:1},settlement:{cash:180,wood:2,ore:1},barracks:{cash:120,wood:1,wheat:1},
 mill:{cash:100,wheat:1,ore:1},works:{cash:100,wood:1,sheep:1},lab:{cash:200,ore:2,wheat:1},
 dock:{cash:80,wood:1,brick:1},hire:{cash:100,sheep:1},boat:{cash:90,wood:1}
};
export const hexDist=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
export const bonus=p=>Math.max(0,(p?.grade||0)-1);
