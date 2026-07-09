const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/igen-erp');
  console.log('Connected to MongoDB');
  
  const ResourceItem = mongoose.model('ResourceItem', new mongoose.Schema({}, { strict: false }));
  
  const allItems = await ResourceItem.find({}).lean();
  console.log('All documents in ResourceItem:');
  console.log(JSON.stringify(allItems, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
