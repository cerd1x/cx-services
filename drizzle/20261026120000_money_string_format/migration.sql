UPDATE `transaction` SET
	`amount` = json_extract(`amount`, '$.currency') || ' ' || json_extract(`amount`, '$.amount'),
	`capital` = json_extract(`capital`, '$.currency') || ' ' || json_extract(`capital`, '$.amount')
WHERE json_valid(`amount`) = 1;
