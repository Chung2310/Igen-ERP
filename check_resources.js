const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/igen-erp');
  console.log('Connected to MongoDB');
  
  const ResourceItem = mongoose.model('ResourceItem', new mongoose.Schema({}, { strict: false }));
  
  const items = await ResourceItem.find({ name: '_GOOGLE DOCUMENTS' }).lean();
  console.log('Found documents with name _GOOGLE DOCUMENTS:');
  console.log(JSON.stringify(items, null, 2));
  
  const allItems = await ResourceItem.find({ isFixed: true }).lean();
  console.log('\nFound documents with isFixed: true:');
  console.log(JSON.stringify(allItems, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
