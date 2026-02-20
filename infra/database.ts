export const database = new sst.aws.Dynamo("ImagixTable", {
  fields: {
    pk: "string",
    sk: "string",
    gsi1pk: "string",
    gsi1sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk", projection: "all" },
  },
  transform: {
    table: {
      billingMode: "PAY_PER_REQUEST",
    },
  },
});
