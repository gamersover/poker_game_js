const min    = 100000;                            //最小值
const max    = 999999;                            //最大值
const range  = max - min;                         //取值范围差

exports.geneRoomNumber = () => {
    const random = Math.random();                     //小于1的随机数
    return min + Math.round(random * range);  //最小数加随机数*范围差
}

exports.shuffle = (array) => {
    let currentIndex = array.length,  randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }

    return array;
  }